/**
 * 文件上传：presign → upload → create core node
 * 内容 hash 缓存：相同文件不重复上传
 */

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { z } from "zod"
import { apiPost, uploadRaw } from "./api"

const MAX_FILE_SIZE = 200 * 1024 * 1024
const CACHE_DIR = path.join(os.homedir(), ".videoinu")
const UPLOAD_CACHE_PATH = path.join(CACHE_DIR, "upload_cache.json")

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".json": "application/json",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
}

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_MAP[ext] ?? "application/octet-stream"
}

function detectAssetType(mime: string, filePath: string): string {
  if (filePath.toLowerCase().endsWith(".json") || mime === "application/json") return "json"
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("text/")) return "text"
  return "file"
}

// ---------------------------------------------------------------------------
// Upload cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  core_node_id: string
  asset_type: string
  file_url?: string
  uploaded_at: string
}

type UploadCache = Record<string, CacheEntry>

function readUploadCache(): UploadCache {
  try {
    return JSON.parse(fs.readFileSync(UPLOAD_CACHE_PATH, "utf-8")) as UploadCache
  } catch {
    return {}
  }
}

function writeUploadCache(cache: UploadCache): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(UPLOAD_CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8")
}

function fileContentHash(filePath: string): string {
  const content = fs.readFileSync(filePath)
  return crypto.createHash("md5").update(content).digest("hex")
}

// ---------------------------------------------------------------------------
// Core node creation
// ---------------------------------------------------------------------------

const PresignResponse = z.object({
  upload_url: z.string(),
  file_url: z.string(),
})

const CreateCoreNodesResponse = z.object({
  core_node_ids: z.array(z.string()),
})

async function createCoreNodes(nodes: Record<string, unknown>[]): Promise<string[]> {
  const data = await apiPost("/core_nodes", { nodes })
  return CreateCoreNodesResponse.parse(data).core_node_ids
}

export async function createTextCoreNode(content: string): Promise<string> {
  const ids = await createCoreNodes([{ asset_type: "text", content }])
  return ids[0]
}

export async function createJsonCoreNode(content: unknown): Promise<string> {
  const ids = await createCoreNodes([{ asset_type: "json", content: JSON.stringify(content) }])
  return ids[0]
}

export async function createUrlCoreNode(url: string, assetType: string): Promise<string> {
  const ids = await createCoreNodes([{ asset_type: assetType, url }])
  return ids[0]
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/**
 * 内部使用（含 core_node_id），仅模块内消费、不作为 CLI 外部契约
 */
export interface UploadResult {
  core_node_id: string
  file_url?: string
  asset_type: string
  cached?: boolean
}

/** 对外 CLI 返回的上传结果（不含任何 ID） */
export interface PublicUploadResult {
  local_path: string
  asset_type: string
  remote_url?: string
  cached?: boolean
}

/** 上传本地文件，返回 core_node_id（相同内容命中缓存时跳过上传） */
export async function uploadFile(filePath: string): Promise<UploadResult> {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`)

  const stat = fs.statSync(resolved)
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${stat.size} bytes). Max: ${MAX_FILE_SIZE} bytes`)
  }

  const mime = guessMime(resolved)
  const assetType = detectAssetType(mime, resolved)

  // text / json 内容可能频繁变化，不走文件缓存
  if (assetType === "text") {
    const content = fs.readFileSync(resolved, "utf-8")
    return { core_node_id: await createTextCoreNode(content), asset_type: "text" }
  }
  if (assetType === "json") {
    const content = JSON.parse(fs.readFileSync(resolved, "utf-8"))
    return { core_node_id: await createJsonCoreNode(content), asset_type: "json" }
  }

  // 二进制文件：检查缓存
  const hash = fileContentHash(resolved)
  const cache = readUploadCache()
  const cached = cache[hash]
  if (cached) {
    return {
      core_node_id: cached.core_node_id,
      file_url: cached.file_url,
      asset_type: cached.asset_type,
      cached: true,
    }
  }

  // presign → upload → create core node
  const ext = path.extname(resolved).replace(".", "").toLowerCase() || "bin"
  const presignData = await apiPost("/core_nodes/upload/presign", { type: assetType, format: ext })
  const presign = PresignResponse.parse(presignData)

  const fileBytes = fs.readFileSync(resolved)
  await uploadRaw(presign.upload_url, fileBytes, mime)

  const coreNodeId = await createUrlCoreNode(presign.file_url, assetType)

  // 写入缓存
  cache[hash] = {
    core_node_id: coreNodeId,
    asset_type: assetType,
    file_url: presign.file_url,
    uploaded_at: new Date().toISOString(),
  }
  writeUploadCache(cache)

  return { core_node_id: coreNodeId, file_url: presign.file_url, asset_type: assetType }
}

/** 面向 CLI：上传后只返回 {local_path, asset_type, remote_url?, cached?}，不暴露 ID */
export async function uploadFilePublic(filePath: string): Promise<PublicUploadResult> {
  const result = await uploadFile(filePath)
  const resolved = path.resolve(filePath)
  return {
    local_path: resolved,
    asset_type: result.asset_type,
    ...(result.file_url ? { remote_url: result.file_url } : {}),
    ...(result.cached ? { cached: true } : {}),
  }
}
