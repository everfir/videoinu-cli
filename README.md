# videoinu-cli

Videoinu 平台的官方命令行工具——在终端里运行 AI 工作流（图片 / 视频 / 音频生成），同时面向 **人类开发者** 和 **AI agent** 设计。

## 特性

- **AI Agent 友好**：所有命令向 stdout 输出结构化 JSON，stderr 输出进度日志，退出码标准化
- **输入自动识别**：本地文件路径、远程 URL、内联文本 / JSON 自动分派到对应的上传或下载逻辑
- **产物自动落盘**：`run --wait` 阻塞执行完成后把所有二进制产物按语义化命名写入本地
- **MD5 去重上传**：同一文件不会重复上传

## 安装

需要 Node.js >= 18。

```bash
npm install -g @everfir/videoinu-cli
```

pnpm / yarn 亦可：

```bash
pnpm add -g @everfir/videoinu-cli
yarn global add @everfir/videoinu-cli
```

免安装调用：

```bash
npx @everfir/videoinu-cli <command>
```

安装后终端里可直接用 `videoinu` 命令（二进制名独立于包名），执行 `videoinu --help` 验证。

## 快速开始

```bash
# 1. 保存 access key（videoinu.com → Profile → Copy Access Key）
videoinu auth save <access-key>

# 2. 诊断：网络、认证、token 有效性一次性检查
videoinu doctor

# 3. 搜索工作流定义
videoinu workflow list --search "text-to-video"

# 4. 查看输入 / 输出 schema（run 之前必做）
videoinu workflow describe <definition-id>

# 5. 执行工作流，阻塞直到完成并把产物下载到本地
videoinu run <definition-id> \
  --input-spec '{"prompt":"a cat"}' \
  --wait \
  --download-dir ./out \
  --download-prefix hero-portrait
# 产物：./out/hero-portrait_<slot>_<idx>.<ext>
```

## 命令列表

| 命令 | 作用 |
|---|---|
| `auth save/status/verify/logout` | 管理 access key |
| `config set/get/list/path` | 读写配置（目前仅 `access_key`） |
| `doctor` | 认证 + 端点连通 + token 有效性检查 |
| `workflow list` | 列出工作流定义，支持 `--search / --group / --function / --tag` |
| `workflow describe <def-id>` | 输出完整 `input_schema` / `output_configs` |
| `run <def-id>` | 执行工作流 |
| `status <instance-id>` | 查状态；`--outputs` 下载产物；`--poll <sec>` 阻塞轮询 |
| `upload <file>` | 预上传（MD5 缓存）。`run` 会自动上传，通常不需手调 |
| `download <urls...> --prefix <slug>` | 把远程 URL 批量下载到本地 |
| `credits` | 余额 / 订阅信息 |

所有子命令都支持 `--help`，例如 `videoinu run --help`。

## 核心概念

| 概念 | 说明 |
|---|---|
| Definition | 可复用的工作流模板，含 `input_schema` 与 `output_configs` |
| Instance | 一次工作流执行，状态为 `pending / running / completed / failed / cancelled` |
| Asset | 默认执行容器：每次 `run` 创建一个独立 Asset |
| Graph | 可选容器：把多个 `run` 归到同一画布，用 `--graph-id` 或 `--new-graph` |

## `run` 详解

```bash
videoinu run <def-id> \
  --input-spec <json> \
  [--wait --download-dir <dir> --download-prefix <slug>] \
  [--graph-id <id> | --new-graph <name>] \
  [--asset-name <name>] [--count <n>] \
  [--timeout <sec>] [--interval <sec>] \
  [--estimate]
```

### `--input-spec` 类型自动推断

key 使用 `workflow describe` 返回的 `input_schema[].name`，value 按以下顺序判定：

1. 字符串指向本地存在的文件 → 自动上传为该 slot 的 asset
2. 字符串以 `http(s)://` 开头 → 下载后上传
3. 形如 `{"type":"text|json|file|url", ...}` → 显式指定
4. 纯字符串 → 文本内容
5. 对象 / 数组，且 slot `data_type === "json"` → JSON 内容

示例：

```json
{"prompt":"a cat","image":"./photo.png"}
{"prompt":"a cat","image":"https://example.com/pic.png"}
```

### 下载约定

`--wait` 必须同时传 `--download-dir` 与 `--download-prefix`。二进制产物一律落盘，文件名：

```
<prefix>_<slot>_<idx>.<ext>
```

文本 / JSON 类产物以 `content` 字段内联返回，不落盘。`--download-prefix` 建议使用语义化 slug（如 `hero-portrait`），避免随机串。

### 执行模式（互斥）

| 选项 | 效果 |
|---|---|
| 默认 | 创建新 Asset（`--asset-name` 可命名，省略则自动生成） |
| `--graph-id <id>` | 在已存在的 Graph 里运行 |
| `--new-graph <name>` | 新建 Graph 并在其中运行 |

### 超时参考

| 类型 | 典型耗时 |
|---|---|
| 图片生成 | 1–5 分钟 |
| 音乐 / 音频 | 2–5 分钟 |
| 视频生成 | 5–20 分钟 |

使用 `--wait` 时，请把调用方（shell / agent）的超时放到 10 分钟以上。

## AI Agent 集成

videoinu-cli 的输出契约为 agent 场景优化：

- **stdout 只有 JSON**：可直接 `JSON.parse`，无多余文本
- **stderr 放日志**：进度、提示、错误描述都走 stderr，不污染 stdout
- **退出码**：`0` 成功，非 `0` 失败；失败时 stdout 依然是 JSON `{error, message, ...}`
- **下载路径可预测**：`--download-prefix` + `slot` + `idx` 可提前拼出文件名

典型 agent 流程：

```
workflow describe <def-id>   # 读取 input_schema，决定要收集哪些输入
          ↓
run <def-id> --input-spec ... --wait --download-dir ... --download-prefix ...
          ↓
解析 stdout JSON 中 instances[*].outputs[*].local_path
```

## 认证与配置

| 文件 | 内容 | 权限 |
|---|---|---|
| `~/.videoinu/credentials.json` | `auth save` 写入的 access key | 0600 |
| `~/.videoinu/config.json` | 用户配置（目前仅 `access_key`） | 默认 |

优先级：`config.json` > `credentials.json`。推荐用 `videoinu auth save` 管理凭据。

Access key 即身份凭证，等同于账号密码，请勿提交到代码仓库或分享给他人。泄露后可通过 videoinu.com 重新生成。

## 反馈与贡献

- **问题反馈**：https://github.com/everfir/videoinu-cli/issues
- **Pull Request**：欢迎提交修复、文档改进、新平台适配等贡献
- **变更历史**：见 [CHANGELOG.md](./CHANGELOG.md)

## License

[Apache License 2.0](./LICENSE) © 2026 Everfir
