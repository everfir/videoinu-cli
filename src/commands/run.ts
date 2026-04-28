import {
  getDefinition,
  buildInputs,
  runWorkflow,
  waitForWorkflow,
  resolveOutputs,
  collectDownloadUrls,
  downloadFiles,
  progressCallback,
  estimateCost,
  type ResolvedNode,
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

/** 对 image/video 类型的 input core_node 执行 ark asset 审核 */
async function reviewInputNodes(
  createdNodes: ResolvedNode[],
  opts: { timeout: number; interval: number }
): Promise<void> {
  const toReview = createdNodes.filter((n) => REVIEW_MEDIA_TYPES.has(n.asset_type))
  if (toReview.length === 0) return

  process.stderr.write(`Submitting ${toReview.length} media input(s) for ark asset review...\n`)
  for (const node of toReview) {
    const result = await ensureActive(node.core_node_id, {
      timeout: opts.timeout,
      interval: opts.interval,
      onProgress: (status) =>
        process.stderr.write(`[review] ${node.slot_name} (${node.core_node_id.slice(0, 8)}...) status=${status}\n`),
    })
    if (result.cached) {
      process.stderr.write(`[review] ${node.slot_name}: already Active (cached)\n`)
    } else {
      process.stderr.write(`[review] ${node.slot_name}: Active\n`)
    }
  }
}

export async function runRun(opts: {
  definitionId: string
  inputSpec?: string
  inputs?: string
  mode: "create_asset" | "create_graph" | "in_graph"
  assetName?: string
  graphName?: string
  graphId?: string
  count: number
  wait: boolean
  timeout: number
  interval: number
  downloadDir?: string
  downloadPrefix?: string
  review?: boolean
  estimate?: boolean
}) {
  const definition = await getDefinition(opts.definitionId)

  let inputs: Record<string, unknown>
  let createdNodes: ResolvedNode[] = []

  if (opts.inputs) {
    inputs = JSON.parse(opts.inputs)
  } else {
    const spec = opts.inputSpec ? JSON.parse(opts.inputSpec) : {}
    const built = await buildInputs(spec, definition.input_schema)
    inputs = built.inputs
    createdNodes = built.createdNodes
  }

  // ark asset 审核：--review 显式指定，或自动检测 seedance 系列
  const shouldReview = opts.review ?? needsArkReview(definition)
  if (shouldReview && createdNodes.length > 0) {
    await reviewInputNodes(createdNodes, { timeout: opts.timeout || 300, interval: opts.interval || 5 })
  }

  // 价格预估
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
    created_input_core_nodes: createdNodes,
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
      const outputs = await resolveOutputs(instance)
      instanceResult.outputs = outputs

      if (opts.downloadDir) {
        const urls = collectDownloadUrls(outputs)
        const { downloaded, errors } = await downloadFiles(
          urls,
          opts.downloadDir,
          opts.downloadPrefix || instanceId
        )
        instanceResult.downloaded = downloaded
        if (errors.length) instanceResult.download_errors = errors
      }
    } else if (status.warning) {
      // 超时未完成，给出续接命令
      const dlPart = opts.downloadDir ? ` --download-dir ${opts.downloadDir}` : ""
      process.stderr.write(
        `Timed out. Continue with:\n` +
        `  videoinu status ${instanceId} --poll 1800 --outputs${dlPart}\n`
      )
    }

    instanceResults.push(instanceResult)
  }

  result.instances = instanceResults
  console.log(JSON.stringify(result, null, 2))
}
