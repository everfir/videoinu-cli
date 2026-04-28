import {
  getInstanceStatus,
  waitForWorkflow,
  getInstance,
  resolveOutputs,
  collectDownloadUrls,
  downloadFiles,
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

  if (opts.outputs || opts.downloadDir) {
    // poll 模式已经拿到 instance，不需要再请求
    if (!instance) instance = await getInstance(instanceId)
    const outputs = await resolveOutputs(instance)
    result.outputs = outputs

    if (opts.downloadDir) {
      const urls = collectDownloadUrls(outputs)
      const { downloaded, errors } = await downloadFiles(
        urls,
        opts.downloadDir,
        opts.downloadPrefix || instanceId
      )
      result.downloaded = downloaded
      if (errors.length) result.download_errors = errors
    }
  }

  console.log(JSON.stringify(result, null, 2))
}
