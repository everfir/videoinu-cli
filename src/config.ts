import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const CONFIG_DIR = path.join(os.homedir(), ".videoinu")
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json")

const API_BASE_URL = "https://videoinu.com"

type AccessKeySource = "credentials" | null

/** 读取 access key，同时返回来源。 */
export function resolveAccessKey(): { key: string | undefined; source: AccessKeySource } {
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8")
    const parsed = JSON.parse(raw) as { access_key?: string }
    if (parsed.access_key) return { key: parsed.access_key, source: "credentials" }
  } catch {
    // credentials.json 不存在或解析失败
  }
  return { key: undefined, source: null }
}

/** 便捷方法：只取 key 值 */
export function getAccessKey(): string | undefined {
  return resolveAccessKey().key
}

/** 保存 access key 到 credentials.json（权限 0600） */
export function saveAccessKey(token: string): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CREDENTIALS_FILE, `${JSON.stringify({ access_key: token }, null, 2)}\n`, "utf-8")
  fs.chmodSync(CREDENTIALS_FILE, 0o600)
}

/** 删除 credentials.json */
export function removeAccessKey(): boolean {
  try {
    fs.unlinkSync(CREDENTIALS_FILE)
    return true
  } catch {
    return false
  }
}

export function getBaseUrl(): string {
  return API_BASE_URL
}

export const CREDENTIALS_FILE_PATH = CREDENTIALS_FILE
