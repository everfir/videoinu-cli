import fs from "node:fs"
import {
  resolveAccessKey,
  saveAccessKey,
  removeAccessKey,
  CREDENTIALS_FILE_PATH,
} from "../config"
import { apiGet } from "../api"

export async function runAuthSave(token: string) {
  saveAccessKey(token)
  console.log(
    JSON.stringify({
      status: "saved",
      credentials_path: CREDENTIALS_FILE_PATH,
    })
  )
}

export async function runAuthStatus() {
  const { key, source } = resolveAccessKey()

  const sourceLabel =
    source === "credentials" ? `credentials file (${CREDENTIALS_FILE_PATH})`
    : source === "config" ? "config file (access_key)"
    : null

  console.log(
    JSON.stringify({
      authenticated: !!key,
      source: sourceLabel,
      credentials_file_exists: fs.existsSync(CREDENTIALS_FILE_PATH),
    })
  )
}

export async function runAuthVerify() {
  // 用 list graphs page_size=1 来验证 token
  await apiGet("/graph/list", { page: 1, page_size: 1 })
  console.log(JSON.stringify({ status: "verified", message: "Access key is valid." }))
}

export async function runAuthLogout() {
  const removed = removeAccessKey()
  console.log(
    JSON.stringify(
      removed
        ? { status: "logged_out", message: "Credentials removed." }
        : { status: "no_credentials", message: "No saved credentials found." }
    )
  )
}
