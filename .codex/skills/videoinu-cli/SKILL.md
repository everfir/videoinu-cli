---
name: videoinu-cli
description: Videoinu 平台 CLI 执行 skill。用 `videoinu` 命令跑工作流、查实例状态、上传素材、管理 core_node_id。触发场景：跑 workflow、查 run 失败、describe input-schema、上传文件、查询 instance 状态、下载产物、ark-asset 审核。
---

# Videoinu CLI Skill

把用户意图或上游产出的 `input-spec` 送进 `videoinu` CLI，拿到产出。纯执行层，不做 prompt engineering、不做分镜、不做多步编排决策。

## 子命令速查

| 命令 | 作用 |
|------|------|
| `videoinu auth save/status/verify/logout` | 管理 access key |
| `videoinu doctor` | 检查认证和网络连通 |
| `videoinu config set/get/list/path` | 读写 `~/.videoinu/config.json`（`access_key`、`api_base`）|
| `videoinu workflow list` | 列出工作流定义（支持 `--search` / `--group` / `--function` / `--tag` / `--refresh`）|
| `videoinu workflow describe <def-id>` | 看 `input_schema` / `output_configs`——跑 `run` 前必做 |
| `videoinu run <def-id> --input-spec <json>` | 执行工作流；常用 `--wait --download-dir` / `--count` / `--estimate` |
| `videoinu status <instance-id>` | 查实例状态；`--outputs` 拿产物，`--poll` 轮询，`--download-dir` 下载 |
| `videoinu upload <file>` | 上传本地文件换 `core_node_id` |
| `videoinu credits` | 查账户余额 |
| `videoinu ark-asset submit <file-or-id> [--wait]` | 手动提交内容审核（Seedance2 工作流会自动走，审核失败时兜底）|
| `videoinu ark-asset query <core-node-ids...>` | 查审核状态 |
| `videoinu download <urls...>` | 下载 URL 到本地 |

所有子命令都支持 `--help`。不确定参数就直接跑 `videoinu <cmd> --help` 查。

## 标准执行流程

1. **找工作流**：`videoinu workflow list --search <keyword>`
2. **看 schema**：`videoinu workflow describe <def-id>`
3. **映射输入**：按 `input_schema[].name` 写 `--input-spec` JSON
4. **执行**：`videoinu run <def-id> --input-spec '...' --wait --download-dir ./out`
5. **查状态/下载**（没用 `--wait` 时）：`videoinu status <instance-id> --outputs --poll 300 --download-dir ./out`

详细规则（`--search` 是子串匹配、`--input-spec` 值的自动识别、`--estimate` 语义、shell 超时设置等）见 [references/cli-execution.md](references/cli-execution.md)。

## 硬约束

- 没跑过 `videoinu workflow describe <def-id>`，不输出最终 `run` 命令
- `--input-spec` 的 key 必须来自 `input_schema[].name`，不猜
- stdout 输出 JSON，stderr 输出日志，不混用
- 视频工作流默认 `--wait`，shell 超时至少 600000ms 或走 `run_in_background`
- `--estimate` 是**只估价不执行**；正式跑时不要加（`run` 本身自带估价检查）

## 错误诊断

| 症状 | 先查 |
|------|------|
| `ApiError: slot not found` | `workflow describe` 的 `input_schema[].name` 拼写 |
| `余额不足` | `videoinu credits`，或让用户确认后重试 |
| `上传失败` | 文件路径存在性、`~/.videoinu/` MD5 缓存是否损坏 |
| Seedance 工作流卡在 review | `videoinu ark-asset submit <core-node-id> --wait` 兜底 |
| `run --wait` 超时 | 延长 shell timeout 或切 `run_in_background` + 后续 `videoinu status <instance-id>` 轮询 |

## 耗时参考

- 图像：1-5 分钟
- 音乐/音频：2-5 分钟
- 视频：5-20 分钟

长任务主动告知用户预计耗时范围。

## 何时读 references

| 需要什么 | 读哪个 |
|---------|-------|
| 子命令顺序、--search 规则、--input-spec 值的自动识别规则、--estimate 语义、shell 超时 | [cli-execution.md](references/cli-execution.md) |

简单直跑（用户给了 def-id 和 input-spec）不读。

Plan 文件格式契约（`.md` + `.prompts.json` 结构、占位符规则、状态机、中断恢复）由 `videoinu-direct` skill 管理。
