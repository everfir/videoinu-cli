---
name: videoinu-cli
description: Videoinu 平台 CLI 执行 skill。用 `videoinu` 命令跑工作流、查实例状态、下载产物。触发场景：跑 workflow、查 run 失败、describe input-schema、上传文件、查询 instance 状态、下载产物。
---

# Videoinu CLI Skill

把用户意图或上游产出的 `input-spec` 送进 `videoinu` CLI，拿到产出文件。纯执行层，不做 prompt engineering、不做分镜、不做多步编排决策。

**对用户输出一律中文**：状态播报、结论、错误解释、下一步建议都用中文。命令、字段名、日志关键词、工具原始报错不翻译。

## 资源模型（必读）

所有资源对外只有一个身份：**本地文件路径**。

- **输入**：`--input-spec` 里的 slot 值就是本地路径 / http(s) URL / 文本 / JSON。CLI 内部会自动上传（URL 会先下载再上传），细节不关你事。
- **输出**：`run --wait` 和 `status --outputs` **必须**配 `--download-dir` + `--download-prefix`，产物一律落盘。输出 JSON 里每个 slot 是 `{slot_name, asset_type, local_path?, remote_url?, content?}`——文本/JSON 类 slot 在 `content` 里内联，二进制类在 `local_path` 里。
- **跨 step 复用**：下游 step 的 input 直接写**上一步产物的 local_path 字符串**。CLI 会重新上传（MD5 缓存命中时不占带宽）。没有"引用前序产物"的特殊语法。

审核、上传、ID、缓存全部是 CLI 内部业务，对外从不提及。

## 子命令速查

| 命令 | 作用 |
|------|------|
| `videoinu auth save/status/verify/logout` | 管理 access key |
| `videoinu doctor` | 检查认证和网络连通 |
| `videoinu config set/get/list/path` | 读写 `~/.videoinu/config.json`（`access_key`、`api_base`）|
| `videoinu workflow list` | 列出工作流定义（支持 `--search` / `--group` / `--function` / `--tag` / `--refresh`）|
| `videoinu workflow describe <def-id>` | 看 `input_schema` / `output_configs`——跑 `run` 前必做 |
| `videoinu run <def-id> --input-spec <json> --wait --download-dir ./out --download-prefix <slug>` | 执行工作流；`--wait` 必配下载参数 |
| `videoinu status <instance-id> [--poll <sec>] [--outputs --download-dir ./out --download-prefix <slug>]` | 查实例状态；`--outputs` 必配下载参数 |
| `videoinu upload <file>` | 预上传本地文件（MD5 缓存），返回 `{local_path, asset_type, remote_url?}`。可选，`run` 会自动上传 |
| `videoinu credits` | 查账户余额 |
| `videoinu download <urls...> --prefix <slug>` | 下载外部 URL 到本地（极少用，run/status 已自动下载） |

所有子命令都支持 `--help`。不确定参数就直接跑 `videoinu <cmd> --help` 查。

## 标准执行流程

1. **找工作流**：`videoinu workflow list --search <keyword>`
2. **看 schema**：`videoinu workflow describe <def-id>`
3. **映射输入**：按 `input_schema[].name` 写 `--input-spec` JSON。值可以是本地路径 / URL / 文本 / JSON
4. **执行**：`videoinu run <def-id> --input-spec '...' --wait --download-dir ./out --download-prefix <slug>`
5. **查状态/下载**（没用 `--wait` 时）：`videoinu status <instance-id> --poll 300 --outputs --download-dir ./out --download-prefix <slug>`

详细规则（`--search` 是子串匹配、`--input-spec` 值的自动识别、`--estimate` 语义、shell 超时设置等）见 [references/cli-execution.md](references/cli-execution.md)。

## 硬约束

- 没跑过 `videoinu workflow describe <def-id>`，不输出最终 `run` 命令
- `--input-spec` 的 key 必须来自 `input_schema[].name`，不猜
- stdout 输出 JSON，stderr 输出日志，不混用
- 视频工作流默认 `--wait`，shell 超时至少 600000ms 或走 `run_in_background`
- `--estimate` 是**只估价不执行**；正式跑时不要加（`run` 本身自带估价检查）
- **产物一律落盘**：`run --wait` 必须配 `--download-dir` + `--download-prefix`（未传 exit 1）；`status --outputs` 同理。`--download-prefix` 要描述内容（`hero-portrait`、`shot1-storyboard`），不要用 instance_id / UUID / `out` / `result` 这类无信息词
- **跨 step 复用前序产物**：直接在下一步 input-spec 里填**前一步输出的 local_path 字符串**。没有其他引用语法
- **对用户的文字输出一律中文**，命令、字段名、工具原始报错保留原文

## 错误诊断

| 症状 | 先查 |
|------|------|
| `ApiError: slot not found` | `workflow describe` 的 `input_schema[].name` 拼写 |
| `Unknown input slot` | 同上 |
| `Unsupported input type` | `--input-spec` 里用了 `{type:"..."}` 非法 type，只允许 text/json/file/url |
| `余额不足` | `videoinu credits`，或让用户确认后重试 |
| `上传失败` | 文件路径存在性、`~/.videoinu/` MD5 缓存是否损坏 |
| Seedance 工作流卡在 review | `run` 内部自动做审核，卡住说明是平台审核超时；重新跑或改素材 |
| `run --wait` 超时 | 延长 shell timeout 或切 `run_in_background` + 后续 `videoinu status <instance-id> --poll` 轮询 |

## 耗时参考

- 图像：1-5 分钟
- 音乐/音频：2-5 分钟
- 视频：5-20 分钟

长任务主动告知用户预计耗时范围。

## 何时读 references

| 需要什么 | 读哪个 |
|---------|-------|
| 子命令顺序、--search 规则、--input-spec 值的自动识别规则、--estimate 语义、shell 超时、跨 step 引用本地路径的写法 | [cli-execution.md](references/cli-execution.md) |

简单直跑（用户给了 def-id 和 input-spec）不读。

Plan 文件格式契约（`.md` + `.prompts.json` 结构、状态机、中断恢复）由 `videoinu-direct` skill 管理。
