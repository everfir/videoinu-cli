import os from "node:os"
import path from "node:path"
import { Command } from "commander"
import { ApiError, apiGet } from "./api"
import { runAuthLogout, runAuthSave, runAuthStatus, runAuthVerify } from "./commands/auth"
import { runDoctor } from "./commands/doctor"
import { runRun } from "./commands/run"
import { runStatus } from "./commands/status"
import { runWorkflowList } from "./commands/workflow-list"
import { CONFIG_FILE_PATH, getConfigValue, KNOWN_KEYS, loadConfig, setConfigValue } from "./config"
import { uploadFilePublic } from "./upload"
import { downloadUrls, getDefinition } from "./workflow"

const program = new Command()

program
  .name("videoinu")
  .description(
    `Videoinu CLI — run AI workflows (image/video/audio generation) on the Videoinu platform.

GLOSSARY:
  - Definition: a reusable workflow template (e.g. "text-to-video"). Has input_schema and output_configs.
  - Instance:   a single execution of a definition. Has status (pending/running/completed/failed/cancelled) and outputs.
  - Graph:      a canvas that groups multiple workflow runs together. Optional — default mode creates a standalone Asset instead.
  - Asset:      a standalone project container for workflow runs (the default execution mode).

CONTRACT:
  - All commands output structured JSON to stdout. Parse stdout as JSON.
  - Progress and logs go to stderr. Do not parse stderr as JSON.
  - Exit code 0 = success. Non-zero = error (stderr has message, stdout has JSON with "error" key).
  - Auth is required for all commands except "config" and "doctor".
  - Assets are addressed by local file paths. Inputs take local file paths, URLs, or inline text/JSON.
    Outputs are always written to local files via required --download-dir + --download-prefix.

TYPICAL AGENT WORKFLOW:
  1. videoinu auth save <access-key>                                    # one-time setup
  2. videoinu doctor                                                    # verify connectivity
  3. videoinu workflow list --search "text"                             # find a workflow definition
  4. videoinu workflow describe <def-id>                                # inspect input_schema and output_configs
  5. videoinu run <def-id> --input-spec '{"prompt":"a cat"}' \\
       --wait --download-dir ./out --download-prefix hero-portrait      # outputs land in ./out/hero-portrait_*.ext
  6. videoinu status <instance-id> --outputs \\
       --download-dir ./out --download-prefix hero-portrait             # resume when not using --wait`
  )
  .version("0.1.0")

// ─── config ─────────────────────────────────────────────────────

const configCmd = program
  .command("config")
  .description(
    "Read/write config key-value pairs stored in ~/.videoinu/config.json. " +
      "Keys: access_key (JWT token). API endpoint is fixed to https://videoinu.com."
  )

configCmd
  .command("set")
  .description("Set a config key. Output: {key, set: true, path}.")
  .argument("<key>", `one of: ${Object.keys(KNOWN_KEYS).join(", ")}`)
  .argument("<value>", "value to store (string)")
  .action((key: string, value: string) => {
    setConfigValue(key, value)
    console.log(JSON.stringify({ key: key.toLowerCase(), set: true, path: CONFIG_FILE_PATH }))
  })

configCmd
  .command("get")
  .description("Get a config value. Output: {key, value} where value is string or null if unset.")
  .argument("<key>", "config key to read")
  .action((key: string) => {
    const value = getConfigValue(key)
    console.log(JSON.stringify({ key: key.toLowerCase(), value: value ?? null }))
  })

configCmd
  .command("list")
  .description(
    "List all config key-value pairs. Keys containing 'key' are masked (first 8 chars + '...'). Output: {key: value, ...}."
  )
  .action(() => {
    const config = loadConfig()
    const safe: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(config)) {
      safe[k] = k.includes("key") && v ? `${v.slice(0, 8)}...` : v
    }
    console.log(JSON.stringify(safe))
  })

configCmd
  .command("path")
  .description("Print config file absolute path. Output: {path}.")
  .action(() => {
    console.log(JSON.stringify({ path: CONFIG_FILE_PATH }))
  })

// ─── auth ───────────────────────────────────────────────────────

const authCmd = program
  .command("auth")
  .description(
    "Manage access key authentication. " +
      "The access key is a JWT obtained from videoinu.com (Profile -> Copy Access Key). " +
      "Stored in ~/.videoinu/credentials.json with 0600 permissions."
  )

authCmd
  .command("save")
  .description("Save access key to ~/.videoinu/credentials.json. " + "Output: {status: 'saved', credentials_path}.")
  .argument("<token>", "JWT access key string (from videoinu.com Profile -> Copy Access Key)")
  .action(async (token: string) => {
    await runAuthSave(token)
  })

authCmd
  .command("status")
  .description(
    "Check whether an access key is configured and its source. " +
      "Output: {authenticated: bool, source: string|null, credentials_file_exists: bool}. " +
      "Does NOT verify the key is valid — use 'auth verify' for that."
  )
  .action(async () => {
    await runAuthStatus()
  })

authCmd
  .command("verify")
  .description(
    "Test that the saved access key is accepted by the API (makes a real API call). " +
      "Output on success: {status: 'verified'}. Throws ApiError if key is invalid or expired."
  )
  .action(async () => {
    await runAuthVerify()
  })

authCmd
  .command("logout")
  .description(
    "Delete ~/.videoinu/credentials.json. " +
      "Output: {status: 'logged_out'} or {status: 'no_credentials'} if nothing to remove."
  )
  .action(async () => {
    await runAuthLogout()
  })

// ─── doctor ─────────────────────────────────────────────────────

program
  .command("doctor")
  .description(
    "Run diagnostic checks: access_key configured, API endpoint reachable, auth token valid. " +
      "No auth required (checks auth as one of the diagnostics). " +
      "Output: {checks: [{name, status: 'ok'|'fail', detail}], allOk: bool}."
  )
  .action(async () => {
    await runDoctor()
  })

// ─── workflow ───────────────────────────────────────────────────

const wfCmd = program
  .command("workflow")
  .description(
    "List and inspect workflow definitions. " +
      "A 'definition' is a reusable workflow template (e.g. 'text-to-image', 'video-upscale'). " +
      "Use 'workflow list' to browse, then 'workflow describe <id>' to see input/output schema before running."
  )

wfCmd
  .command("list")
  .description(
    "List available workflow definitions (uses local cache, syncs incrementally). " +
      "Output: {definitions: [{id, name, group, function, public}]}. " +
      "Use --search for fuzzy text matching across all fields. " +
      "Use --group/--function for exact tag-based filtering."
  )
  .option("--search <text>", "case-insensitive substring match across all fields (name, id, tags)")
  .option("--group <value>", "exact match on group tag")
  .option("--function <value>", "exact match on function tag (e.g. 'generate', 'upscale', 'edit')")
  .option("--tag <value...>", "require exact tag match; repeatable, all must match")
  .option("--refresh", "bypass cache, fetch full list from API")
  .action(async (opts: { search?: string; group?: string; function?: string; tag?: string[]; refresh?: boolean }) => {
    await runWorkflowList({
      search: opts.search,
      group: opts.group,
      fn: opts.function,
      tag: opts.tag,
      refresh: opts.refresh,
    })
  })

wfCmd
  .command("describe")
  .description(
    "Show full workflow definition including input_schema and output_configs. " +
      "IMPORTANT: Always call this before 'run' to understand required inputs. " +
      "Output: {definition: {id, name, description, input_schema: [{name, display_name, data_type, required, multiple, min_count, max_count, description, json_schema, default_value}], output_configs: [{slot_name, display_name, data_type, role}]}}. " +
      "data_type values: 'text', 'image', 'video', 'audio', 'json', 'pdf', 'file'. " +
      "Use input_schema[].name as slot_name keys in --input-spec for 'run'."
  )
  .argument("<definition-id>", "workflow definition ID (from 'workflow list' output)")
  .action(async (definitionId: string) => {
    const def = await getDefinition(definitionId)
    console.log(JSON.stringify({ definition: def }, null, 2))
  })

// ─── run ────────────────────────────────────────────────────────

program
  .command("run")
  .description(
    `Execute a workflow definition. Use 'workflow describe' first to learn required inputs.

OUTPUT (without --wait): {definition_id, definition_name, mode, instance_ids: string[], asset_id, graph_id}
OUTPUT (with --wait):    adds instances: [{instance_id, status, progress,
                                            outputs: [{slot_name, asset_type, local_path?, remote_url?, content?}],
                                            download_errors?: [{slot_name, error}]}]

INPUT SPEC (--input-spec): JSON object where keys are slot names from 'workflow describe' (input_schema[].name).
  Each value is auto-coerced:
    1. string matching an existing local file path → uploaded as the slot's asset
    2. string starting with http(s):// → downloaded then uploaded (asset_type inferred from slot)
    3. object with "type" field: {type:"text"|"json"|"file"|"url", ...} — explicit form
    4. plain string → text content
    5. object/array when slot data_type is "json" → JSON content
  Example: {"prompt":"a cat","image":"./photo.png"}  OR  {"prompt":"a cat","image":"https://x.com/pic.png"}

EXECUTION MODES (mutually exclusive):
  - Default: creates a standalone Asset (name auto-generated if --asset-name omitted)
  - --graph-id: runs inside an existing Graph
  - --new-graph: creates a new Graph with the given name, then runs inside it

DOWNLOAD (REQUIRED with --wait):
  --download-dir and --download-prefix are required whenever --wait is set. Outputs are written as
  <prefix>_<slot>_<idx>.<ext>. Text/JSON outputs are inlined as 'content'. There is no way to keep
  outputs remote-only — all binary results are always downloaded to disk.

TIMING: --wait blocks until the workflow reaches a terminal status. Typical durations:
  - Image generation: 1-5 minutes
  - Music/audio generation: 2-5 minutes
  - Video generation: 5-20 minutes
  Agents should set a sufficient shell timeout (e.g. 600000ms+) or use run_in_background when --wait is on.`
  )
  .argument("<definition-id>", "workflow definition ID (from 'workflow list')")
  .option(
    "--input-spec <json>",
    "JSON mapping slot names to values (auto-coerced). See command description for coercion rules."
  )
  .option("--graph-id <id>", "run inside this existing graph. Mutually exclusive with --new-graph")
  .option(
    "--new-graph <name>",
    "create a new graph with this name and run inside it. Mutually exclusive with --graph-id"
  )
  .option(
    "--asset-name <name>",
    "name for the created Asset (auto-generated if omitted). Ignored when --graph-id or --new-graph is used"
  )
  .option(
    "--count <n>",
    "run the same workflow N times with identical inputs to generate multiple variants",
    (v) => parseInt(v, 10),
    1
  )
  .option(
    "--wait",
    "block until all instances reach terminal status (completed/failed/cancelled). Required when you want outputs."
  )
  .option(
    "--timeout <seconds>",
    "max seconds to wait (0 = no limit). Only effective with --wait",
    (v) => parseInt(v, 10),
    0
  )
  .option("--interval <seconds>", "polling interval in seconds. Only effective with --wait", (v) => parseInt(v, 10), 15)
  .option("--download-dir <dir>", "REQUIRED with --wait. Directory for downloaded output files.")
  .option(
    "--download-prefix <prefix>",
    "REQUIRED with --wait. Semantic filename prefix (e.g. 'shot1-hero'); filenames become <prefix>_<slot>_<idx>.<ext>. Random/hash-like values are discouraged."
  )
  .option("--review", "force content review for media inputs (auto-detected for Seedance2 workflows)")
  .option("--no-review", "skip content review even for Seedance2 workflows")
  .option("--estimate", "estimate cost without executing. Output: {estimated_cost, user_credits, can_afford}")
  .action(
    async (
      definitionId: string,
      opts: {
        inputSpec?: string
        graphId?: string
        newGraph?: string
        assetName?: string
        count: number
        wait?: boolean
        timeout: number
        interval: number
        downloadDir?: string
        downloadPrefix?: string
        review?: boolean
        estimate?: boolean
      }
    ) => {
      if (opts.graphId && opts.newGraph) {
        process.stderr.write("Error: use either --graph-id or --new-graph, not both\n")
        process.exit(1)
      }
      if (opts.wait && !opts.estimate && (!opts.downloadDir || !opts.downloadPrefix)) {
        process.stderr.write(
          "Error: --wait requires both --download-dir and --download-prefix. " +
            "Outputs are always written to disk. Example: --download-dir ./out --download-prefix shot1-hero\n"
        )
        process.exit(1)
      }
      if ((opts.downloadDir || opts.downloadPrefix) && !opts.wait) {
        process.stderr.write("Error: --download-dir / --download-prefix require --wait.\n")
        process.exit(1)
      }

      const mode = opts.graphId ? "in_graph" : opts.newGraph ? "create_graph" : "create_asset"

      await runRun({
        definitionId,
        inputSpec: opts.inputSpec,
        mode,
        assetName: opts.assetName,
        graphName: opts.newGraph,
        graphId: opts.graphId,
        count: opts.count,
        wait: opts.wait ?? false,
        timeout: opts.timeout,
        interval: opts.interval,
        downloadDir: opts.downloadDir ?? "",
        downloadPrefix: opts.downloadPrefix ?? "",
        review: opts.review,
        estimate: opts.estimate,
      })
    }
  )

// ─── status ─────────────────────────────────────────────────────

program
  .command("status")
  .description(
    `Query a workflow instance's current status. Use this to check on runs started without --wait.

OUTPUT: {instance_id, status: 'pending'|'running'|'completed'|'failed'|'cancelled', progress: 0-100}
  With --outputs: adds outputs: [{slot_name, asset_type, local_path?, remote_url?, content?}]
                  REQUIRES --download-dir + --download-prefix (outputs are always written to disk)
  With --poll:    blocks until terminal status or timeout, progress on stderr`
  )
  .argument("<instance-id>", "workflow instance ID (from 'run' output's instance_ids array)")
  .option(
    "--poll <timeout-seconds>",
    "block and poll until terminal status or timeout (value is max seconds, e.g. --poll 300)",
    (v) => parseInt(v, 10)
  )
  .option("--interval <seconds>", "polling interval in seconds. Only effective with --poll", (v) => parseInt(v, 10), 15)
  .option("--outputs", "resolve outputs and download them to disk. Requires --download-dir and --download-prefix.")
  .option("--download-dir <dir>", "REQUIRED with --outputs. Directory for downloaded output files.")
  .option(
    "--download-prefix <prefix>",
    "REQUIRED with --outputs. Semantic filename prefix (e.g. 'shot1-hero'); filenames become <prefix>_<slot>_<idx>.<ext>. Random/hash-like values are discouraged."
  )
  .action(
    async (
      instanceId: string,
      opts: {
        poll?: number
        interval?: number
        outputs?: boolean
        downloadDir?: string
        downloadPrefix?: string
      }
    ) => {
      if (opts.outputs && (!opts.downloadDir || !opts.downloadPrefix)) {
        process.stderr.write(
          "Error: --outputs requires both --download-dir and --download-prefix. " +
            "Outputs are always written to disk. Example: --download-dir ./out --download-prefix shot1-hero\n"
        )
        process.exit(1)
      }
      if ((opts.downloadDir || opts.downloadPrefix) && !opts.outputs) {
        process.stderr.write("Error: --download-dir / --download-prefix require --outputs.\n")
        process.exit(1)
      }
      await runStatus(instanceId, opts)
    }
  )

// ─── upload ─────────────────────────────────────────────────────

program
  .command("upload")
  .description(
    "Pre-upload a local file to Videoinu (MD5-cached so the same file won't re-upload). " +
      "asset_type is auto-detected from extension: image (png/jpg/webp/gif), video (mp4/mov/webm), audio (mp3/wav/ogg/flac), text (txt), json, pdf. Max 200MB. " +
      "Output: {local_path, asset_type, remote_url?, cached?}. " +
      "You do NOT need to call 'upload' before 'run' — 'run --input-spec' auto-uploads any local path. " +
      "Use 'upload' only when you want to pre-upload (e.g. for dedup) or obtain remote_url for sharing."
  )
  .argument("<file>", "local file path (absolute or relative)")
  .action(async (file: string) => {
    const result = await uploadFilePublic(file)
    console.log(JSON.stringify(result, null, 2))
  })

// ─── credits ────────────────────────────────────────────────────

program
  .command("credits")
  .description(
    "Show account credits balance and subscription info. " +
      "Output: {credits: number, subscription_type, duration_type, nickname, email}. " +
      "Check credits before running expensive workflows to avoid insufficient-credits errors."
  )
  .action(async () => {
    const data = (await apiGet("/account/get_user_info", undefined, "/api")) as Record<string, unknown>
    console.log(
      JSON.stringify(
        {
          credits: data.credits,
          subscription_type: data.subscription_type,
          duration_type: data.duration_type,
          nickname: data.nickname,
          email: data.email,
        },
        null,
        2
      )
    )
  })

// ─── download ───────────────────────────────────────────────────

program
  .command("download")
  .description(
    "Download files from URLs to local disk. Rarely needed — 'run --wait' and 'status --outputs' already download automatically. " +
      "Use this only for one-off URL saves (e.g. a shared remote_url from another user). " +
      "REQUIRES --prefix: a short semantic slug describing what these files are (e.g. 'hero-portrait', 'shot1-storyboard'). " +
      "Output filenames: <prefix>_<idx>.<ext>. " +
      "Output: {output_dir, downloaded: string[], total: number, errors?: [{url, error}]}."
  )
  .argument("<urls...>", "one or more URLs to download (space-separated)")
  .option(
    "-o, --output-dir <dir>",
    "target directory (default: ~/Downloads/videoinu_results)",
    path.join(os.homedir(), "Downloads/videoinu_results")
  )
  .requiredOption(
    "--prefix <prefix>",
    "REQUIRED. Semantic filename prefix describing the content (e.g. 'hero-portrait'). Random/hash-like prefixes are discouraged."
  )
  .action(async (urls: string[], opts: { outputDir: string; prefix: string }) => {
    const { downloaded, errors } = await downloadUrls(urls, opts.outputDir, opts.prefix)
    const result: Record<string, unknown> = { output_dir: opts.outputDir, downloaded, total: downloaded.length }
    if (errors.length) result.errors = errors
    console.log(JSON.stringify(result, null, 2))
  })

// ─── error handling ─────────────────────────────────────────────

async function main() {
  try {
    await program.parseAsync()
  } catch (err) {
    const error: Record<string, unknown> = { error: "Error", message: "" }
    if (err instanceof ApiError) {
      error.error = "ApiError"
      error.message = err.message
      if (err.status) error.status = err.status
      if (err.errCode) error.err_code = err.errCode
    } else if (err instanceof Error) {
      error.message = err.message
    } else {
      error.message = String(err)
    }
    process.stderr.write(`[videoinu error] ${error.error}: ${error.message}\n`)
    console.log(JSON.stringify(error))
    process.exit(1)
  }
}

main()
