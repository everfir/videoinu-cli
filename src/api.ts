/**
 * Videoinu HTTP client.
 *
 * Auth: Cookie: token=<ACCESS_KEY>
 * Response envelope: { err_code: 0, err_msg: "", data: ... }
 */

import { z } from "zod"
import { getAccessKey, getBaseUrl } from "./config"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ApiEnvelope = z.object({
  err_code: z.number(),
  err_msg: z.string().optional().default(""),
  data: z.unknown(),
})

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public errCode?: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function requireAccessKey(): string {
  const key = getAccessKey()
  if (!key) {
    throw new ApiError(
      "Access key not set. Run: videoinu auth save <your-key> " +
        "(get it from Profile -> Copy Access Key on videoinu.com)"
    )
  }
  return key
}

function authHeaders(method: "GET" | "POST" = "GET"): Record<string, string> {
  const headers: Record<string, string> = {
    Cookie: `token=${requireAccessKey()}`,
    Accept: "application/json",
    "x-everfir-business": "ace",
  }
  if (method === "POST") headers["Content-Type"] = "application/json"
  return headers
}

function buildUrl(path: string, prefix = "/api/backend"): string {
  return `${getBaseUrl()}${prefix}${path}`
}

async function unwrapEnvelope(res: Response): Promise<unknown> {
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new ApiError(`HTTP ${res.status}: ${text.slice(0, 500)}`, res.status)
  }
  const json = await res.json()
  const envelope = ApiEnvelope.parse(json)
  if (envelope.err_code !== 0) {
    throw new ApiError(`API error ${envelope.err_code}: ${envelope.err_msg}`, undefined, envelope.err_code)
  }
  return envelope.data
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export async function apiGet(
  path: string,
  params?: Record<string, string | number | boolean>,
  prefix?: string
): Promise<unknown> {
  let url = buildUrl(path, prefix)
  if (params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
    url += `?${qs.toString()}`
  }
  const res = await fetch(url, { method: "GET", headers: authHeaders("GET") })
  return unwrapEnvelope(res)
}

export async function apiPost(
  path: string,
  body?: Record<string, unknown>,
  prefix?: string
): Promise<unknown> {
  const res = await fetch(buildUrl(path, prefix), {
    method: "POST",
    headers: authHeaders("POST"),
    body: JSON.stringify(body ?? {}),
  })
  return unwrapEnvelope(res)
}

/** PUT raw bytes 到 presigned URL */
export async function uploadRaw(uploadUrl: string, file: Buffer, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  })
  if (!res.ok) {
    throw new ApiError(`Upload failed: HTTP ${res.status}`, res.status)
  }
}

/** 下载文件，返回 Buffer */
export async function downloadBuffer(url: string): Promise<Buffer> {
  const headers: Record<string, string> = { Accept: "*/*" }
  const accessKey = getAccessKey()
  if (accessKey) headers.Cookie = `token=${accessKey}`
  headers.Referer = getBaseUrl()

  const res = await fetch(url, { headers })
  if (!res.ok) throw new ApiError(`Download failed: HTTP ${res.status}`, res.status)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error(`Empty response from ${url}`)
  return buf
}
