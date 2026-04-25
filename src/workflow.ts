/**
 * Workflow 核心逻辑：定义列表/详情、input 构建、执行、状态轮询、输出解析
 */

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { z } from "zod"
import { apiGet, apiPost, downloadBuffer } from "./api"
import { uploadFile, createTextCoreNode, createJsonCoreNode } from "./upload"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const InputSlotSchema = z.object({
  name: z.string(),
  display_name: z.string().default(""),
  data_type: z.string().default(""),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
  min_count: z.number().nullable().default(null),
  max_count: z.number().nullable().default(null),
  description: z.string().default(""),
  json_schema: z.unknown().optional(),
  default_value: z.unknown().optional(),
  shape: z.unknown().optional(),
})

export type InputSlot = z.infer<typeof InputSlotSchema>

const OutputConfigSchema = z.object({
  slot_name: z.string(),
  display_name: z.string().default(""),
  data_type: z.string().default(""),
  role: z.string().default(""),
})

const DefinitionSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  description: z.string().default(""),
  version: z.union([z.string(), z.number()]).optional(),
  tags: z.array(z.string()).default([]),
  public: z.boolean().default(false),
  icon_url: z.string().default(""),
  input_schema: z.array(InputSlotSchema).default([]),
  output_configs: z.array(OutputConfigSchema).default([]),
})

export type WorkflowDefinition = z.infer<typeof DefinitionSchema>

// ---------------------------------------------------------------------------
// Summary cache
// ---------------------------------------------------------------------------

const VIDEOINU_DIR = path.join(os.homedir(), ".videoinu")
const CACHE_PATH = path.join(VIDEOINU_DIR, "workflow_summaries.json")
const CACHE_VERSION = 1

interface SummaryCache {
  version: number
  last_synced_at: number | null
  definitions: Record<string, unknown>[]
}

function readCache(): SummaryCache {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"))
    if (raw?.version !== CACHE_VERSION) return { version: CACHE_VERSION, last_synced_at: null, definitions: [] }
    return raw as SummaryCache
  } catch {
    return { version: CACHE_VERSION, last_synced_at: null, definitions: [] }
  }
}

function writeCache(cache: SummaryCache): void {
  fs.mkdirSync(VIDEOINU_DIR, { recursive: true })
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8")
}

// ---------------------------------------------------------------------------
// 定义列表 & 详情
// ---------------------------------------------------------------------------

function extractTagValue(tags: string[], prefix: string): string {
  for (const tag of tags) {
    if (tag.startsWith(prefix)) return tag.slice(prefix.length)
  }
  return ""
}

export function summarizeBrief(def: Record<string, unknown>): Record<string, unknown> {
  const tags = Array.isArray(def.tags) ? (def.tags as string[]) : []
  return {
    id: def.id ?? "",
    name: def.name ?? "",
    group: extractTagValue(tags, "group:"),
    function: extractTagValue(tags, "function:"),
    public: def.public ?? false,
  }
}

export async function listDefinitions(opts?: {
  forceRefresh?: boolean
  includePublic?: boolean
}): Promise<Record<string, unknown>[]> {
  const cache = readCache()
  const params: Record<string, string | number | boolean> = {
    include_public: opts?.includePublic !== false ? "true" : "false",
  }
  if (!opts?.forceRefresh && cache.last_synced_at != null) {
    params.last_updated_at = cache.last_synced_at + 1
  }

  const raw = await apiGet("/wf/definition/list_summary", params)
  const updates = normalizeListResponse(raw)

  let current: Record<string, unknown>[]
  if (opts?.forceRefresh || cache.last_synced_at == null) {
    current = updates.filter((d) => !d.is_deleted)
  } else {
    const map = new Map(cache.definitions.map((d) => [d.id as string, d]))
    for (const item of updates) {
      if (item.is_deleted) map.delete(item.id as string)
      else map.set(item.id as string, item)
    }
    current = [...map.values()]
  }

  const maxUpdated = updates
    .map((d) => (typeof d.updated_at === "number" ? d.updated_at : 0))
    .reduce((a, b) => Math.max(a, b), cache.last_synced_at ?? 0)

  writeCache({ version: CACHE_VERSION, last_synced_at: maxUpdated || null, definitions: current })
  return current
}

function normalizeListResponse(data: unknown): Record<string, unknown>[] {
  if (data && typeof data === "object" && "definitions" in data && Array.isArray((data as Record<string, unknown>).definitions)) {
    return (data as Record<string, unknown>).definitions as Record<string, unknown>[]
  }
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  return []
}

export async function getDefinition(definitionId: string): Promise<WorkflowDefinition> {
  const full = (await apiGet(`/wf/definition/${definitionId}`)) as Record<string, unknown>
  const innerDef = full?.definition ?? full
  return DefinitionSchema.parse(innerDef)
}

// ---------------------------------------------------------------------------
// Input 构建（从 input-spec 到后端输入格式；内部管理 ID，不对外暴露）
// ---------------------------------------------------------------------------

/** 内部产物：记录一次 input 构建过程中落地的所有 core_node_id（审核等业务逻辑内部使用，不对外） */
export interface InternalInputNode {
  slot_name: string
  core_node_id: string
  asset_type: string
  source_kind: string
}

/**
 * 下载远端 URL 到临时文件，返回本地路径。
 * 用于"始终走上传"策略：URL 输入 → 下载 → 作为本地文件上传。
 */
async function downloadUrlToTemp(url: string): Promise<string> {
  const buf = await downloadBuffer(url)
  const tmpRoot = path.join(os.tmpdir(), "videoinu-upload")
  fs.mkdirSync(tmpRoot, { recursive: true })
  const parsedPath = new URL(url).pathname
  const ext = path.extname(parsedPath) || ".bin"
  const tmpFile = path.join(tmpRoot, `${crypto.randomUUID()}${ext}`)
  fs.writeFileSync(tmpFile, buf)
  return tmpFile
}

async function resolveInputItem(
  item: Record<string, unknown>,
  slot: InputSlot
): Promise<{ core_node_id: string; asset_type: string; source_kind: string }> {
  const type = item.type as string | undefined

  if (type === "text") {
    const content = item.content as string
    return { core_node_id: await createTextCoreNode(content), asset_type: "text", source_kind: "text" }
  }
  if (type === "json") {
    let content = item.content
    if (typeof content === "string") content = JSON.parse(content)
    return { core_node_id: await createJsonCoreNode(content), asset_type: "json", source_kind: "json" }
  }
  if (type === "file") {
    const result = await uploadFile(item.path as string)
    return { core_node_id: result.core_node_id, asset_type: result.asset_type, source_kind: "file" }
  }
  if (type === "url") {
    // 始终走上传：远端 URL → 下载到临时文件 → 走常规上传链路（MD5 缓存仍生效）
    const tmp = await downloadUrlToTemp(item.url as string)
    try {
      const result = await uploadFile(tmp)
      return { core_node_id: result.core_node_id, asset_type: result.asset_type, source_kind: "url" }
    } finally {
      try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    }
  }
  throw new Error(`Unknown input type '${type}' for slot '${slot.name}'`)
}

/**
 * 自动推断 raw value 的类型。
 * 对外只接受：本地路径 / http(s) URL / 纯字符串 / 对象（文本/json/file/url 四类）。
 * 不接受 core_node_id — 该概念已完全内部化。
 */
function coerceItem(value: unknown, slot: InputSlot): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if (obj.type) {
      const t = obj.type as string
      if (["text", "json", "file", "url"].includes(t)) return obj
      throw new Error(`Unsupported input type '${t}' for slot '${slot.name}' (allowed: text/json/file/url)`)
    }
    if (slot.data_type === "json") return { type: "json", content: value }
  }
  if (typeof value === "string") {
    if (fs.existsSync(path.resolve(value))) return { type: "file", path: value }
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return { type: "url", url: value, asset_type: slot.data_type || undefined }
    }
    if (slot.data_type === "json") return { type: "json", content: JSON.parse(value) }
    return { type: "text", content: value }
  }
  if (Array.isArray(value) && slot.data_type === "json") {
    return { type: "json", content: value }
  }
  throw new Error(`Cannot coerce input for slot '${slot.name}': ${JSON.stringify(value)}`)
}

export async function buildInputs(
  spec: Record<string, unknown>,
  inputSchema: InputSlot[]
): Promise<{ inputs: Record<string, unknown>; createdNodes: InternalInputNode[] }> {
  const schemaMap = new Map(inputSchema.map((s) => [s.name, s]))
  const inputs: Record<string, unknown> = {}
  const createdNodes: InternalInputNode[] = []

  for (const [slotName, rawValue] of Object.entries(spec)) {
    const slot = schemaMap.get(slotName)
    if (!slot) throw new Error(`Unknown input slot: ${slotName}`)

    // normalize to array
    const rawItems =
      slot.data_type === "json" && Array.isArray(rawValue) && !slot.multiple
        ? [rawValue]
        : Array.isArray(rawValue)
          ? rawValue
          : [rawValue]

    const coerced = rawItems.map((v) => coerceItem(v, slot))
    const resolved = await Promise.all(coerced.map((item) => resolveInputItem(item, slot)))
    const ids = resolved.map((r) => r.core_node_id)

    if (!slot.multiple && ids.length > 1) throw new Error(`Slot '${slotName}' does not accept multiple values`)
    if (slot.max_count != null && ids.length > slot.max_count) {
      throw new Error(`Slot '${slotName}' accepts at most ${slot.max_count} values`)
    }

    inputs[slotName] = { type: "core_node_refs", core_node_ids: ids }
    for (const r of resolved) {
      createdNodes.push({ slot_name: slotName, ...r })
    }
  }

  const missing = inputSchema
    .filter((s) => s.required)
    .filter((s) => {
      const v = inputs[s.name] as { core_node_ids?: string[] } | undefined
      const minCount = s.min_count ?? 1
      return !v || v.core_node_ids!.length < minCount
    })
    .map((s) => s.name)

  if (missing.length > 0) throw new Error(`Missing required inputs: ${missing.join(", ")}`)

  return { inputs, createdNodes }
}

// ---------------------------------------------------------------------------
// 价格预估
// ---------------------------------------------------------------------------

const EstimateResponse = z.object({
  estimated_cost: z.number(),
  definition_id: z.string(),
  definition_version: z.number().optional(),
  user_credits: z.number(),
  can_afford: z.boolean(),
})

export type EstimateResult = z.infer<typeof EstimateResponse>

export async function estimateCost(
  definitionId: string,
  inputs: Record<string, unknown>
): Promise<EstimateResult> {
  const data = await apiPost(`/wf/definition/${definitionId}/estimate`, { inputs })
  return EstimateResponse.parse(data)
}

// ---------------------------------------------------------------------------
// 执行 workflow
// ---------------------------------------------------------------------------

const RunResponseSchema = z.object({
  instance_ids: z.array(z.string()).optional(),
  instances: z
    .array(z.object({ instance_id: z.string() }))
    .optional(),
  instance_id: z.string().optional(),
  asset_id: z.string().optional(),
  graph_id: z.string().optional(),
})

function extractInstanceIds(parsed: z.infer<typeof RunResponseSchema>): string[] {
  if (parsed.instances?.length) return parsed.instances.map((i) => i.instance_id)
  if (parsed.instance_ids?.length) return parsed.instance_ids
  if (parsed.instance_id) return [parsed.instance_id]
  throw new Error(`No instance IDs in run response: ${JSON.stringify(parsed)}`)
}

export async function runWorkflow(opts: {
  definitionId: string
  inputs: Record<string, unknown>
  mode: "create_asset" | "create_graph" | "in_graph"
  assetName?: string
  graphName?: string
  graphId?: string
  count?: number
}): Promise<{ instanceIds: string[]; assetId?: string; graphId?: string }> {
  let data: unknown
  if (opts.mode === "in_graph") {
    data = await apiPost("/wf/instance/run_in_graph", {
      definition_id: opts.definitionId,
      inputs: opts.inputs,
      graph_id: opts.graphId,
      count: (opts.count ?? 1) > 1 ? opts.count : undefined,
    })
  } else if (opts.mode === "create_graph") {
    data = await apiPost("/wf/instance/run_create_graph", {
      definition_id: opts.definitionId,
      inputs: opts.inputs,
      graph_name: opts.graphName ?? `Workflow ${new Date().toISOString()}`,
    })
  } else {
    data = await apiPost("/wf/instance/run_create_asset", {
      definition_id: opts.definitionId,
      inputs: opts.inputs,
      asset_name: opts.assetName ?? `Workflow ${new Date().toISOString()}`,
      count: (opts.count ?? 1) > 1 ? opts.count : undefined,
    })
  }

  const parsed = RunResponseSchema.parse(data)
  return {
    instanceIds: extractInstanceIds(parsed),
    assetId: parsed.asset_id,
    graphId: parsed.graph_id,
  }
}

// ---------------------------------------------------------------------------
// 状态轮询
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])

export interface InstanceStatus {
  instance_id: string
  status: string
  progress: number
  warning?: string
}

export async function getInstance(instanceId: string): Promise<Record<string, unknown>> {
  const data = (await apiGet(`/wf/instance/${instanceId}`)) as Record<string, unknown>
  return ((data?.instance ?? data) as Record<string, unknown>) ?? {}
}

function normalizeProgress(raw: number): number {
  if (raw > 0 && raw <= 1) return raw * 100
  return raw
}

function toStatus(instance: Record<string, unknown>, instanceId: string): InstanceStatus {
  return {
    instance_id: (instance.id as string) ?? instanceId,
    status: (instance.status as string) ?? "unknown",
    progress: normalizeProgress((instance.progress as number) ?? 0),
  }
}

export async function getInstanceStatus(instanceId: string): Promise<InstanceStatus> {
  return toStatus(await getInstance(instanceId), instanceId)
}

export interface WaitResult {
  status: InstanceStatus
  instance: Record<string, unknown>
}

export async function waitForWorkflow(
  instanceId: string,
  opts?: {
    timeout?: number
    interval?: number
    onProgress?: (status: InstanceStatus) => void
  }
): Promise<WaitResult> {
  const timeout = opts?.timeout ?? 0  // 0 = 无限等待
  const interval = opts?.interval ?? 3
  const start = Date.now()

  let instance: Record<string, unknown> = {}
  for (;;) {
    instance = await getInstance(instanceId)
    const status = toStatus(instance, instanceId)
    opts?.onProgress?.(status)
    if (TERMINAL_STATUSES.has(status.status)) return { status, instance }
    if (timeout > 0 && Date.now() - start >= timeout * 1000) {
      return { status: { ...status, warning: "Polling timed out" }, instance }
    }
    await sleep(interval * 1000)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** progress 已在 toStatus 中归一化到 0-100，这里直接输出 */
export function progressCallback(status: InstanceStatus): void {
  process.stderr.write(`[${status.status}] progress=${status.progress.toFixed(0)}%\n`)
}

// ---------------------------------------------------------------------------
// 输出解析 & 下载
// ---------------------------------------------------------------------------

const BatchCoreNodesResponse = z.object({
  core_nodes: z.array(z.record(z.unknown())).optional(),
})

export async function batchGetCoreNodes(ids: string[]): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return []
  const data = await apiPost("/core_nodes/batch_v2", { core_node_ids: ids })
  // data 可能是 { core_nodes: [...] } 或直接是 [...]
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  const parsed = BatchCoreNodesResponse.parse(data)
  return parsed.core_nodes ?? []
}

/**
 * 内部：从 instance.outputs 提取 {slot_name, core_node_id} 引用。
 * 只在 CLI 内部使用，不对外暴露。
 */
interface InternalOutputRef {
  slot_name: string
  core_node_id: string
}

function extractOutputRefs(instance: Record<string, unknown>): InternalOutputRef[] {
  const outputs = instance.outputs
  if (!Array.isArray(outputs)) return []
  return outputs
    .filter((item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).core_node_id === "string"
    )
    .map((item) => ({
      slot_name: (item.slot_name as string) ?? "",
      core_node_id: item.core_node_id as string,
    }))
}

/** 对外输出项：文件化语义，不含任何 ID */
export interface OutputItem {
  slot_name: string
  asset_type: string
  local_path?: string      // 下载后的本地路径（二进制资产）
  remote_url?: string      // 平台上的公开 URL（用于分享，不作为输入引用）
  content?: unknown        // 文本/JSON 资产的内联内容
}

/** slot_name / 任意字符串 → 文件名安全片段 */
function slugifySegment(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * 解析 instance 的 outputs 并下载到本地。
 * - URL 类资产：必下载；文件名 `<prefix>_<slot-slug>_<idx>.<ext>`
 * - 文本/JSON 类资产：不下载，content 直接内联在返回项里
 * prefix 必传，保证文件名语义化。
 *
 * 返回 {items, errors}；errors 只来自下载失败，解析失败会抛异常。
 */
export async function resolveOutputsAndDownload(
  instance: Record<string, unknown>,
  outputDir: string,
  prefix: string
): Promise<{ items: OutputItem[]; errors: { slot_name: string; error: string }[] }> {
  if (!prefix || !prefix.trim()) {
    throw new Error("resolveOutputsAndDownload: prefix is required (semantic filename)")
  }
  const prefixSlug = slugifySegment(prefix)
  if (!prefixSlug) {
    throw new Error(`resolveOutputsAndDownload: prefix "${prefix}" contains no filename-safe characters`)
  }

  const refs = extractOutputRefs(instance)
  if (refs.length === 0) return { items: [], errors: [] }

  const nodes = await batchGetCoreNodes(refs.map((r) => r.core_node_id))
  const nodeMap = new Map(nodes.map((n) => [n.id as string, n]))

  fs.mkdirSync(outputDir, { recursive: true })

  const items: OutputItem[] = []
  const errors: { slot_name: string; error: string }[] = []

  await Promise.all(
    refs.map(async (ref, i) => {
      const node = nodeMap.get(ref.core_node_id)
      const data = (node?.data as Record<string, unknown> | undefined) ?? {}
      const assetType = (data.asset_type as string) ?? ""
      const url = data.url as string | undefined
      const content = data.content

      const item: OutputItem = {
        slot_name: ref.slot_name,
        asset_type: assetType,
      }

      if (content != null) item.content = content
      if (url) item.remote_url = url

      // 仅对有 URL 的资产下载
      if (url) {
        try {
          const parsedPath = new URL(url).pathname
          const ext = path.extname(parsedPath) || ".bin"
          const idx = String(i + 1).padStart(3, "0")
          const slotPart = ref.slot_name ? `_${slugifySegment(ref.slot_name) || "slot"}` : ""
          const filename = `${prefixSlug}${slotPart}_${idx}${ext}`
          const localPath = path.join(outputDir, filename)
          const buf = await downloadBuffer(url)
          fs.writeFileSync(localPath, buf)
          item.local_path = localPath
        } catch (e) {
          errors.push({ slot_name: ref.slot_name, error: e instanceof Error ? e.message : String(e) })
        }
      }

      items.push(item)
    })
  )

  items.sort((a, b) => (a.slot_name < b.slot_name ? -1 : a.slot_name > b.slot_name ? 1 : 0))
  return { items, errors }
}

/**
 * 顶层 `videoinu download <urls...>` 使用：下载任意 URL 列表到本地。
 * 无 slot 语义，命名 `<prefix>_<idx>.<ext>`。
 */
export async function downloadUrls(
  urls: string[],
  outputDir: string,
  prefix: string
): Promise<{ downloaded: string[]; errors: { url: string; error: string }[] }> {
  if (!prefix || !prefix.trim()) {
    throw new Error("downloadUrls: prefix is required (semantic filename)")
  }
  const prefixSlug = slugifySegment(prefix)
  if (!prefixSlug) {
    throw new Error(`downloadUrls: prefix "${prefix}" contains no filename-safe characters`)
  }

  fs.mkdirSync(outputDir, { recursive: true })
  const downloaded: string[] = []
  const errors: { url: string; error: string }[] = []

  await Promise.all(
    urls.map(async (url, i) => {
      const parsedPath = new URL(url).pathname
      const ext = path.extname(parsedPath) || ".bin"
      const idx = String(i + 1).padStart(3, "0")
      const filename = `${prefixSlug}_${idx}${ext}`
      const localPath = path.join(outputDir, filename)
      try {
        const buf = await downloadBuffer(url)
        fs.writeFileSync(localPath, buf)
        downloaded.push(localPath)
      } catch (e) {
        errors.push({ url, error: e instanceof Error ? e.message : String(e) })
      }
    })
  )

  return { downloaded: downloaded.sort(), errors }
}
