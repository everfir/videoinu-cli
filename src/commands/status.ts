import {
  getInstanceStatus,
  waitForWorkflow,
  getInstance,
  resolveOutputsAndDownload,
  progressCallback,
  type InstanceStatus,
} from "../workflow"

export async function runStatus(
  instanceId: string,
  opts: {
    poll?: number
    interval?: number
    outputs?: boolean
    downloadDir?: string
    downloadPrefix?: string
  }
) {
  let status: InstanceStatus
  let instance: Record<string, unknown> | undefined

  if (opts.poll) {
    const waited = await waitForWorkflow(instanceId, {
      timeout: opts.poll,
      interval: opts.interval ?? 3,
      onProgress: progressCallback,
    })
    status = waited.status
    instance = waited.instance
  } else {
    status = await getInstanceStatus(instanceId)
  }

  const result: Record<string, unknown> = { ...status }

  if (opts.outputs) {
    // poll 模式已经拿到 instance，不需要再请求
    if (!instance) instance = await getInstance(instanceId)
    const { items, errors } = await resolveOutputsAndDownload(
      instance,
      opts.downloadDir!,
      opts.downloadPrefix!
    )
    result.outputs = items
    if (errors.length) result.download_errors = errors
  }

  console.log(JSON.stringify(result, null, 2))
}
