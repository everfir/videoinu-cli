import {
  getDefinition,
  buildInputs,
  runWorkflow,
  waitForWorkflow,
  resolveOutputsAndDownload,
  progressCallback,
  estimateCost,
  type InternalInputNode,
  type WorkflowDefinition,
} from "../workflow"
import { ensureActive } from "../ark-asset"

const REVIEW_MEDIA_TYPES = new Set(["image", "video"])

/** definition 的 tags/name 包含 seedance 相关标识时需要素材审核 */
function needsArkReview(def: WorkflowDefinition): boolean {
  const name = def.name.toLowerCase()
  if (name.includes("seedance")) return true
  return def.tags.some((t) => t.toLowerCase().includes("seedance"))
}

/** 对 image/video 类型的 input 执行 ark asset 审核（内部使用 core_node_id，不对外暴露） */
async function reviewInputNodes(
  createdNodes: InternalInputNode[],
  opts: { timeout: number; interval: number }
): Promise<void> {
  const toReview = createdNodes.filter((n) => REVIEW_MEDIA_TYPES.has(n.asset_type))
  if (toReview.length === 0) return

  process.stderr.write(`Submitting ${toReview.length} media input(s) for content review...\n`)
  for (const node of toReview) {
    const result = await ensureActive(node.core_node_id, {
      timeout: opts.timeout,
      interval: opts.interval,
      onProgress: (status) =>
        process.stderr.write(`[review] ${node.slot_name} status=${status}\n`),
    })
    if (result.cached) {
      process.stderr.write(`[review] ${node.slot_name}: already approved (cached)\n`)
    } else {
      process.stderr.write(`[review] ${node.slot_name}: approved\n`)
    }
  }
}

export async function runRun(opts: {
  definitionId: string
  inputSpec?: string
  mode: "create_asset" | "create_graph" | "in_graph"
  assetName?: string
  graphName?: string
  graphId?: string
  count: number
  wait: boolean
  timeout: number
  interval: number
  downloadDir: string
  downloadPrefix: string
  review?: boolean
  estimate?: boolean
}) {
  const definition = await getDefinition(opts.definitionId)

  const spec = opts.inputSpec ? JSON.parse(opts.inputSpec) : {}
  const built = await buildInputs(spec, definition.input_schema)
  const inputs = built.inputs
  const createdNodes = built.createdNodes

  const shouldReview = opts.review ?? needsArkReview(definition)
  if (shouldReview && createdNodes.length > 0) {
    await reviewInputNodes(createdNodes, { timeout: opts.timeout || 300, interval: opts.interval || 5 })
  }

  const estimate = await estimateCost(opts.definitionId, inputs)

  if (opts.estimate) {
    console.log(JSON.stringify({
      ...estimate,
      definition_name: definition.name,
    }, null, 2))
    return
  }

  if (!estimate.can_afford) {
    throw new Error(
      `Insufficient credits: need ${estimate.estimated_cost}, have ${estimate.user_credits}. ` +
      `Top up at videoinu.com before running.`
    )
  }

  process.stderr.write(
    `Cost: ${estimate.estimated_cost} credits (balance: ${estimate.user_credits})\n`
  )

  const { instanceIds, assetId, graphId } = await runWorkflow({
    definitionId: opts.definitionId,
    inputs,
    mode: opts.mode,
    assetName: opts.assetName,
    graphName: opts.graphName,
    graphId: opts.graphId,
    count: opts.count,
  })

  const result: Record<string, unknown> = {
    definition_id: opts.definitionId,
    definition_name: definition.name,
    mode: opts.mode,
    instance_ids: instanceIds,
    asset_id: assetId ?? "",
    graph_id: graphId ?? "",
  }

  if (!opts.wait) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const instanceResults: Record<string, unknown>[] = []

  for (const instanceId of instanceIds) {
    const { status, instance } = await waitForWorkflow(instanceId, {
      timeout: opts.timeout,
      interval: opts.interval,
      onProgress: progressCallback,
    })

    const instanceResult: Record<string, unknown> = {
      instance_id: instanceId,
      status: status.status,
      progress: status.progress,
    }
    if (status.warning) instanceResult.warning = status.warning

    if (status.status === "completed") {
      const { items, errors } = await resolveOutputsAndDownload(
        instance,
        opts.downloadDir,
        opts.downloadPrefix
      )
      instanceResult.outputs = items
      if (errors.length) instanceResult.download_errors = errors
    } else if (status.warning) {
      // 超时未完成，给出续接命令
      process.stderr.write(
        `Timed out. Continue with:\n` +
        `  videoinu status ${instanceId} --poll 1800 --download-dir ${opts.downloadDir} --download-prefix ${opts.downloadPrefix}\n`
      )
    }

    instanceResults.push(instanceResult)
  }

  result.instances = instanceResults
  console.log(JSON.stringify(result, null, 2))
}
