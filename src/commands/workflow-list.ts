import { listDefinitions, summarizeBrief } from "../workflow"

export async function runWorkflowList(opts: {
  search?: string
  lane?: string
  group?: string
  fn?: string
  tag?: string[]
  refresh?: boolean
}) {
  let defs = (await listDefinitions({ forceRefresh: opts.refresh })).map(summarizeBrief)

  if (opts.search) {
    const needle = opts.search.toLowerCase()
    defs = defs.filter((d) => JSON.stringify(d).toLowerCase().includes(needle))
  }
  if (opts.lane) {
    const v = opts.lane.toLowerCase()
    defs = defs.filter((d) => (d.lane as string).toLowerCase() === v)
  }
  if (opts.group) {
    const v = opts.group.toLowerCase()
    defs = defs.filter((d) => (d.group as string).toLowerCase() === v)
  }
  if (opts.fn) {
    const v = opts.fn.toLowerCase()
    defs = defs.filter((d) => (d.function as string).toLowerCase() === v)
  }
  if (opts.tag?.length) {
    const required = new Set(opts.tag)
    defs = defs.filter((d) => {
      const tags = new Set(Array.isArray(d.tags) ? (d.tags as string[]) : [])
      return [...required].every((t) => tags.has(t))
    })
  }

  console.log(JSON.stringify({ definitions: defs }, null, 2))
}
