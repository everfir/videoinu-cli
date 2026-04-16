import { resolveAccessKey, getBaseUrl } from "../config"

interface Check {
  name: string
  status: "ok" | "fail"
  detail: string
}

export async function runDoctor() {
  const checks: Check[] = []

  // 1. access key
  const { key, source } = resolveAccessKey()
  checks.push({
    name: "access_key",
    status: key ? "ok" : "fail",
    detail: key
      ? `configured (from ${source})`
      : "not set — run: videoinu auth save <token>",
  })

  // 2. endpoint + auth（一次请求，按 status code 分三种情况）
  const baseUrl = getBaseUrl()
  try {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (key) headers.Cookie = `token=${key}`
    const res = await fetch(`${baseUrl}/api/backend/graph/list?page=1&page_size=1`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    })

    checks.push({
      name: "endpoint",
      status: "ok",
      detail: `${baseUrl} reachable (HTTP ${res.status})`,
    })

    if (key) {
      checks.push({
        name: "auth",
        status: res.ok ? "ok" : "fail",
        detail: res.ok ? "access key valid" : `API returned ${res.status}`,
      })
    }
  } catch (e) {
    checks.push({
      name: "endpoint",
      status: "fail",
      detail: `${baseUrl} unreachable: ${e instanceof Error ? e.message : String(e)}`,
    })
  }

  console.log(JSON.stringify({ checks, allOk: checks.every((c) => c.status === "ok") }, null, 2))
}
