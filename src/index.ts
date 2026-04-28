import os from "node:os"
import path from "node:path"
import { Command } from "commander"
import { ApiError, apiGet } from "./api"
import { loadConfig, setConfigValue, getConfigValue, CONFIG_FILE_PATH, KNOWN_KEYS } from "./config"
import { runAuthSave, runAuthStatus, runAuthVerify, runAuthLogout } from "./commands/auth"
import { runWorkflowList } from "./commands/workflow-list"
import { runRun } from "./commands/run"
import { runStatus } from "./commands/status"
import { runDoctor } from "./commands/doctor"
import { getDefinition, downloadFiles } from "./workflow"
import { uploadFile } from "./upload"
import { submitArkAsset, queryArkAssets, ensureActive } from "./ark-asset"

const program = new Command()

program
  .name("videoinu")
  .description(
    `Videoinu CLI — run AI workflows (image/video/audio generation) on the Videoinu platform.

GLOSSARY:
  - Definition: a reusable workflow template (e.g. "text-to-video"). Has input_schema and output_configs.
  - Instance:   a single execution of a definition. Has status (pending/running/completed/failed/cancelled) and outputs.
  - CoreNode:   an immutable content reference (file, text, JSON) identified by core_node_id. Inputs and outputs are CoreNodes.
  - Graph:      a canvas that groups multiple workflow runs together. Optional — default mode creates a standalone Asset instead.
  - Asset:      a standalone project container for workflow runs (the default execution mode).

CONTRACT:
  - All commands output structured JSON to stdout. Parse stdout as JSON.
  - Progress and logs go to stderr. Do not parse stderr as JSON.
  - Exit code 0 = success. Non-zero = error (stderr has message, stdout has JSON with "error" key).
  - Auth is required for all commands except "config" and "doctor".

TYPICAL AGENT WORKFLOW:
  1. videoinu auth save <access-key>        # one-time setup
  2. videoinu doctor                         # verify connectivity
  3. videoinu workflow list --search "text"   # find a workflow definition
  4. videoinu workflow describe <def-id>      # inspect input_schema and output_configs
  5. videoinu run <def-id> --input-spec '{"prompt":"a cat"}' --wait --download-dir ./out
  6. videoinu status <instance-id> --outputs  # check status if not using --wait`
  )
  .version("0.1.0")

// ─── config ─────────────────────────────────────────────────────

const configCmd = program
  .command("config")
  .description(
    "Read/write config key-value pairs stored in ~/.videoinu/config.json. " +
    "Keys: access_key (JWT token), api_base (API URL, default https://videoinu.com)."
  )

configCmd
  .command("set")
  .description(
    "Set a config key. Output: {key, set: true, path}."
  )
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
  .description("List all config key-value pairs. Keys containing 'key' are masked (first 8 chars + '...'). Output: {key: value, ...}.")
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
  .description(
    "Save access key to ~/.videoinu/credentials.json. " +
    "Output: {status: 'saved', credentials_path}."
  )
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
    "Output: {definitions: [{id, name, lane, group, function, public}]}. " +
    "Use --search for fuzzy text matching across all fields. " +
    "Use --lane/--group/--function for exact tag-based filtering."
  )
  .option("--search <text>", "case-insensitive substring match across all fields (name, id, tags)")
  .option("--lane <value>", "exact match on lane tag (e.g. 'image', 'video', 'audio')")
  .option("--group <value>", "exact match on group tag")
  .option("--function <value>", "exact match on function tag (e.g. 'generate', 'upscale', 'edit')")
  .option("--tag <value...>", "require exact tag match; repeatable, all must match")
  .option("--refresh", "bypass cache, fetch full list from API")
  .action(
    async (opts: {
      search?: string
      lane?: string
      group?: string
      function?: string
      tag?: string[]
      refresh?: boolean
    }) => {
      await runWorkflowList({
        search: opts.search,
        lane: opts.lane,
        group: opts.group,
        fn: opts.function,
        tag: opts.tag,
        refresh: opts.refresh,
      })
    }
  )

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
    `Execute a workflow definition and return instance IDs. Use 'workflow describe' first to learn required inputs.

OUTPUT (without --wait): {definition_id, definition_name, mode, instance_ids: string[], asset_id, graph_id, created_input_core_nodes}
OUTPUT (with --wait):    adds instances: [{instance_id, status, progress, outputs: [{slot_name, core_node_id, core_node: {id, type, asset_type, url, content}}], downloaded?: string[]}]

INPUT SPEC (--input-spec): JSON object where keys are slot names from 'workflow describe' output (input_schema[].name).
  Each value is auto-coerced by these rules (checked in order):
    1. object with "type" field → used as-is. Supported types:
       - {type:"text", content:"..."} → creates text CoreNode
       - {type:"file", path:"./local.png"} → uploads local file, creates CoreNode
       - {type:"url", url:"https://...", asset_type:"image"} → creates CoreNode from URL (asset_type required)
       - {type:"json", content:{...}} → creates JSON CoreNode
       - {type:"core_node", core_node_id:"existing-id"} → references an existing CoreNode (e.g. from 'upload' or 'status --outputs')
    2. string matching an existing local file path → auto-uploaded as file
    3. string starting with http(s):// → treated as URL (asset_type inferred from slot's data_type)
    4. plain string → created as text CoreNode
    5. object/array when slot data_type is "json" → created as JSON CoreNode
  Example: '{"prompt":"a cat","image":{"type":"file","path":"./photo.png"}}'

EXECUTION MODES (mutually exclusive):
  - Default: creates a standalone Asset (name auto-generated as "Workflow <timestamp>" if --asset-name omitted)
  - --graph-id: runs inside an existing Graph
  - --new-graph: creates a new Graph with the given name, then runs inside it

TIMING: --wait blocks until the workflow reaches a terminal status. Typical durations:
  - Image generation: 1-5 minutes
  - Music/audio generation: 2-5 minutes
  - Video generation: 5-20 minutes
  Agents should set a sufficient shell timeout (e.g. 600000ms+) or use run_in_background when calling with --wait.`
  )
  .argument("<definition-id>", "workflow definition ID (from 'workflow list')")
  .option("--inputs <json>", "[advanced] raw inputs JSON in {slot: {type:'core_node_refs', core_node_ids:[...]}} format. Mutually exclusive with --input-spec")
  .option(
    "--input-spec <json>",
    "high-level input JSON mapping slot names to values (auto-coerced to core nodes). Mutually exclusive with --inputs. Prefer this over --inputs."
  )
  .option("--graph-id <id>", "run inside this existing graph. Mutually exclusive with --new-graph")
  .option("--new-graph <name>", "create a new graph with this name and run inside it. Mutually exclusive with --graph-id")
  .option("--asset-name <name>", "name for the created Asset (auto-generated if omitted). Ignored when --graph-id or --new-graph is used")
  .option("--count <n>", "run the same workflow N times with identical inputs to generate multiple variants", parseInt, 1)
  .option("--wait", "block until all instances reach terminal status (completed/failed/cancelled)")
  .option("--timeout <seconds>", "max seconds to wait (0 = no limit). Only effective with --wait", parseInt, 0)
  .option("--interval <seconds>", "polling interval in seconds. Only effective with --wait", parseInt, 3)
  .option("--download-dir <dir>", "download output files to this directory. Requires --wait")
  .option("--download-prefix <prefix>", "filename prefix for downloaded files. Requires --download-dir")
  .option("--review", "force ark asset content review for media inputs (auto-detected for Seedance2 workflows)")
  .option("--no-review", "skip ark asset review even for Seedance2 workflows")
  .option("--estimate", "estimate cost without executing. Output: {estimated_cost, user_credits, can_afford}")
  .action(
    async (
      definitionId: string,
      opts: {
        inputs?: string
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
      if (opts.inputs && opts.inputSpec) {
        process.stderr.write("Error: use either --inputs or --input-spec, not both\n")
        process.exit(1)
      }
      if (opts.graphId && opts.newGraph) {
        process.stderr.write("Error: use either --graph-id or --new-graph, not both\n")
        process.exit(1)
      }

      const mode = opts.graphId ? "in_graph" : opts.newGraph ? "create_graph" : "create_asset"

      await runRun({
        definitionId,
        inputSpec: opts.inputSpec,
        inputs: opts.inputs,
        mode,
        assetName: opts.assetName,
        graphName: opts.newGraph,
        graphId: opts.graphId,
        count: opts.count,
        wait: opts.wait ?? false,
        timeout: opts.timeout,
        interval: opts.interval,
        downloadDir: opts.downloadDir,
        downloadPrefix: opts.downloadPrefix,
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
  With --outputs: adds outputs: [{slot_name, core_node_id, core_node: {id, type, asset_type, url, content}}]
  With --poll:    blocks until terminal status or timeout, with progress on stderr.
  With --download-dir: adds downloaded: string[] (local file paths)`
  )
  .argument("<instance-id>", "workflow instance ID (from 'run' output's instance_ids array)")
  .option("--poll <timeout-seconds>", "block and poll until terminal status or timeout (value is max seconds, e.g. --poll 300)", parseInt)
  .option("--interval <seconds>", "polling interval in seconds. Only effective with --poll", parseInt, 3)
  .option("--outputs", "resolve output core nodes and include in JSON output")
  .option("--download-dir <dir>", "download output files to this directory (implies --outputs)")
  .option("--download-prefix <prefix>", "filename prefix for downloaded files. Requires --download-dir")
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
      await runStatus(instanceId, opts)
    }
  )

// ─── upload ─────────────────────────────────────────────────────

program
  .command("upload")
  .description(
    "Upload a local file to Videoinu and create a CoreNode reference. " +
    "asset_type is auto-detected from file extension: image (png/jpg/webp/gif), video (mp4/mov/webm), audio (mp3/wav/ogg/flac), text (txt), json, pdf. Max 200MB. " +
    "Text and JSON files are read and stored as content (no binary upload). " +
    "Output: {core_node_id: string, file_url?: string, asset_type: string}. " +
    "Use the returned core_node_id in 'run --input-spec' via {type:'core_node', core_node_id:'...'}."
  )
  .argument("<file>", "local file path (absolute or relative)")
  .action(async (file: string) => {
    const result = await uploadFile(file)
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

// ─── ark-asset ──────────────────────────────────────────────────

const arkCmd = program
  .command("ark-asset")
  .description(
    "Manage ark asset review (required by Seedance2 series models). " +
    "Media inputs must pass content review before they can be used in Seedance2 workflows. " +
    "The 'run' command handles this automatically, but these subcommands allow manual control."
  )

arkCmd
  .command("submit")
  .description(
    "Submit a file or core_node_id for content review. " +
    "If a local file path is given, it is uploaded first. " +
    "Output: {core_node_id, asset_id, status}. Status is 'Processing' or 'Active'. " +
    "Use --wait to block until status becomes Active."
  )
  .argument("<file-or-id>", "local file path or existing core_node_id")
  .option("--wait", "block until review completes (Active) or fails")
  .option("--timeout <seconds>", "max seconds to wait", parseInt, 300)
  .option("--interval <seconds>", "polling interval in seconds", parseInt, 5)
  .action(async (fileOrId: string, opts: { wait?: boolean; timeout: number; interval: number }) => {
    // 判断是文件路径还是 core_node_id
    let coreNodeId: string
    const isFile = fileOrId.includes("/") || fileOrId.includes("\\") || fileOrId.includes(".")
    if (isFile) {
      process.stderr.write(`Uploading ${fileOrId}...\n`)
      const uploaded = await uploadFile(fileOrId)
      coreNodeId = uploaded.core_node_id
      process.stderr.write(`Uploaded: core_node_id=${coreNodeId}\n`)
    } else {
      coreNodeId = fileOrId
    }

    if (opts.wait) {
      const result = await ensureActive(coreNodeId, {
        timeout: opts.timeout,
        interval: opts.interval,
        onProgress: (status) => process.stderr.write(`[review] status=${status}\n`),
      })
      console.log(JSON.stringify(result, null, 2))
    } else {
      const result = await submitArkAsset(coreNodeId)
      console.log(JSON.stringify({ core_node_id: coreNodeId, ...result }, null, 2))
    }
  })

arkCmd
  .command("query")
  .description(
    "Query review status for one or more core_node_ids. " +
    "Output: {items: [{core_node_id, asset_id, status}]}. " +
    "Status values: 'Processing' (pending review), 'Active' (approved and usable)."
  )
  .argument("<core-node-ids...>", "one or more core_node_ids to query")
  .action(async (ids: string[]) => {
    const items = await queryArkAssets(ids)
    console.log(JSON.stringify({ items }, null, 2))
  })

// ─── download ───────────────────────────────────────────────────

program
  .command("download")
  .description(
    "Download files from URLs to local disk. Typically used to save output URLs from 'status --outputs'. " +
    "Output: {output_dir, downloaded: string[], total: number, errors?: [{url, error}]}."
  )
  .argument("<urls...>", "one or more URLs to download (space-separated)")
  .option("-o, --output-dir <dir>", "target directory (default: ~/Downloads/videoinu_results)", path.join(os.homedir(), "Downloads/videoinu_results"))
  .option("--prefix <prefix>", "prepend this prefix to filenames (format: prefix_001.ext)")
  .action(async (urls: string[], opts: { outputDir: string; prefix?: string }) => {
    const { downloaded, errors } = await downloadFiles(urls, opts.outputDir, opts.prefix)
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
