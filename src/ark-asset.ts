/**
 * Ark Asset 审核：seedance2 系列模型要求素材先通过审核才能使用。
 * submit → query 轮询 → Active 后可用。
 * 本地缓存避免重复提交。
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { z } from "zod"
import { apiPost } from "./api"

const CACHE_DIR = path.join(os.homedir(), ".videoinu")
const CACHE_PATH = path.join(CACHE_DIR, "ark_asset_cache.json")

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SubmitResponse = z.object({
  asset_id: z.string(),
  status: z.string(),
})

const QueryItem = z.object({
  core_node_id: z.string(),
  asset_id: z.string(),
  status: z.string(),
})

const QueryResponse = z.object({
  items: z.array(QueryItem),
})

type ArkAssetStatus = z.infer<typeof QueryItem>

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  asset_id: string
  status: string
  submitted_at: string
}

type ArkAssetCache = Record<string, CacheEntry>

function readCache(): ArkAssetCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as ArkAssetCache
  } catch {
    return {}
  }
}

function writeCache(cache: ArkAssetCache): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8")
}

function updateCacheEntry(coreNodeId: string, assetId: string, status: string): void {
  const cache = readCache()
  cache[coreNodeId] = {
    asset_id: assetId,
    status,
    submitted_at: cache[coreNodeId]?.submitted_at ?? new Date().toISOString(),
  }
  writeCache(cache)
}

function getCachedStatus(coreNodeId: string): CacheEntry | undefined {
  return readCache()[coreNodeId]
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function submitArkAsset(coreNodeId: string): Promise<{ asset_id: string; status: string }> {
  const data = await apiPost("/ark_asset/submit", { core_node_id: coreNodeId })
  const result = SubmitResponse.parse(data)
  updateCacheEntry(coreNodeId, result.asset_id, result.status)
  return result
}

/** 批量查询审核状态 */
async function queryArkAssets(coreNodeIds: string[]): Promise<ArkAssetStatus[]> {
  if (coreNodeIds.length === 0) return []
  const data = await apiPost("/ark_asset/query", { core_node_ids: coreNodeIds })
  const result = QueryResponse.parse(data)

  // 更新缓存
  for (const item of result.items) {
    updateCacheEntry(item.core_node_id, item.asset_id, item.status)
  }
  return result.items
}

// ---------------------------------------------------------------------------
// 轮询等待 Active
// ---------------------------------------------------------------------------

interface WaitActiveResult {
  core_node_id: string
  asset_id: string
  status: string
  cached: boolean
}

/**
 * 提交并轮询直到 Active 或超时。
 * 如果缓存已 Active，跳过网络请求。
 */
export async function ensureActive(
  coreNodeId: string,
  opts?: {
    timeout?: number
    interval?: number
    onProgress?: (status: string) => void
  }
): Promise<WaitActiveResult> {
  // 缓存命中
  const cached = getCachedStatus(coreNodeId)
  if (cached?.status === "Active") {
    return { core_node_id: coreNodeId, asset_id: cached.asset_id, status: "Active", cached: true }
  }

  // 提交
  const submitted = await submitArkAsset(coreNodeId)
  if (submitted.status === "Active") {
    return { core_node_id: coreNodeId, asset_id: submitted.asset_id, status: "Active", cached: false }
  }

  // 轮询
  const timeout = opts?.timeout ?? 300
  const interval = opts?.interval ?? 15
  const start = Date.now()

  while (Date.now() - start < timeout * 1000) {
    await sleep(interval * 1000)
    const items = await queryArkAssets([coreNodeId])
    const item = items.find((i) => i.core_node_id === coreNodeId)
    const status = item?.status ?? "unknown"
    opts?.onProgress?.(status)

    if (item && status === "Active") {
      return { core_node_id: coreNodeId, asset_id: item.asset_id, status: "Active", cached: false }
    }
    if (status !== "Processing") {
      throw new Error(`Ark asset review failed for ${coreNodeId}: status=${status}`)
    }
  }

  throw new Error(`Ark asset review timed out for ${coreNodeId} after ${timeout}s`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
