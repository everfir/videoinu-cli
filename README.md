# videoinu-cli

Videoinu CLI — 在 Videoinu 平台上运行 AI 工作流（图片/视频/音频生成）。

## 安装

```bash
pnpm install
pnpm build
```

需要 Node.js >= 18。

## 快速开始

```bash
# 1. 保存 access key（从 videoinu.com 个人资料页获取）
videoinu auth save <access-key>

# 2. 验证连接
videoinu doctor

# 3. 搜索工作流
videoinu workflow list --search "text-to-video"

# 4. 查看工作流输入/输出定义
videoinu workflow describe <definition-id>

# 5. 运行工作流
videoinu run <definition-id> --input-spec '{"prompt":"a cat"}' --wait --download-dir ./out

# 6. 查询状态（未使用 --wait 时）
videoinu status <instance-id> --outputs
```

## 命令

| 命令 | 说明 |
|---|---|
| `auth save/status/verify/logout` | 管理 access key 认证 |
| `config set/get/list/path` | 读写配置 |
| `doctor` | 诊断检查（连接、认证） |
| `workflow list` | 列出可用工作流定义 |
| `workflow describe <id>` | 查看工作流输入/输出 schema |
| `run <id>` | 执行工作流 |
| `status <id>` | 查询实例状态和输出 |
| `upload <file>` | 上传文件，返回 core_node_id |
| `download <urls...>` | 下载输出文件到本地 |
| `credits` | 查看账户余额 |
| `ark-asset submit/query` | 管理内容审核（Seedance2 系列模型） |

## 输出约定

- 所有命令向 stdout 输出结构化 JSON
- 进度和日志输出到 stderr
- 退出码 0 = 成功，非零 = 错误

## 开发

```bash
pnpm dev          # 监听模式构建
pnpm typecheck    # 类型检查
pnpm test         # 运行测试
```

## License

Private
