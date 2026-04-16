import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const CONFIG_DIR = path.join(os.homedir(), ".videoinu")
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json")
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json")

export const KNOWN_KEYS: Record<string, string> = {
  access_key: "Videoinu access key (JWT token from Profile -> Copy Access Key)",
  api_base: "API base URL (default: https://videoinu.com)",
}

interface Config {
  [key: string]: string | undefined
}

export function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8")
    const parsed = JSON.parse(raw) as Config
    const normalized: Config = {}
    for (const [k, v] of Object.entries(parsed)) {
      normalized[k.toLowerCase()] = v
    }
    return normalized
  } catch {
    return {}
  }
}

function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, "utf-8")
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig()
  config[key.toLowerCase()] = value
  saveConfig(config)
}

export function getConfigValue(key: string): string | undefined {
  return loadConfig()[key.toLowerCase()]
}

export type AccessKeySource = "config" | "credentials" | null

/** 读取 access key，同时返回来源。优先级：config.json > credentials.json */
export function resolveAccessKey(): { key: string | undefined; source: AccessKeySource } {
  const configVal = loadConfig().access_key
  if (configVal) return { key: configVal, source: "config" }

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
  return getConfigValue("api_base") || "https://videoinu.com"
}

export const CONFIG_DIR_PATH = CONFIG_DIR
export const CONFIG_FILE_PATH = CONFIG_FILE
export const CREDENTIALS_FILE_PATH = CREDENTIALS_FILE
