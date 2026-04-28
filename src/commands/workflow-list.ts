import { listDefinitions, summarizeBrief } from "../workflow"

export async function runWorkflowList(opts: {
  search?: string
  group?: string
  fn?: string
  refresh?: boolean
}) {
  let defs = (await listDefinitions({ forceRefresh: opts.refresh })).map(summarizeBrief)

  if (opts.search) {
    const needle = opts.search.toLowerCase()
    defs = defs.filter((d) => JSON.stringify(d).toLowerCase().includes(needle))
  }
  if (opts.group) {
    const v = opts.group.toLowerCase()
    defs = defs.filter((d) => (d.group as string).toLowerCase() === v)
  }
  if (opts.fn) {
    const v = opts.fn.toLowerCase()
    defs = defs.filter((d) => (d.function as string).toLowerCase() === v)
  }

  console.log(JSON.stringify({ definitions: defs }, null, 2))
}
