# AGENTS.md

## 项目概述

videoinu-cli 是 Videoinu 平台的命令行工具，用于运行 AI 工作流（图片/视频/音频生成）。

## 技术栈

- TypeScript 5 (strict mode)，ESM 模块
- Node.js >= 18（使用原生 fetch）
- Commander.js（CLI 框架）、Zod（运行时校验）
- tsup 构建、Vitest 测试、pnpm 包管理

## 项目结构

```
src/
├── index.ts           # CLI 入口，所有命令注册
├── api.ts             # HTTP 客户端，响应信封解析
├── config.ts          # 配置与认证管理（~/.videoinu/）
├── workflow.ts        # 工作流核心逻辑（定义、输入解析、执行、轮询）
├── upload.ts          # 文件上传（presign + MD5 缓存）
├── ark-asset.ts       # 内容审核（Seedance2 模型）
└── commands/
    ├── auth.ts        # 认证子命令
    ├── doctor.ts      # 诊断检查
    ├── workflow-list.ts # 列出工作流定义
    ├── run.ts         # 执行工作流
    └── status.ts      # 查询实例状态
```

## 常用命令

```bash
pnpm build          # 构建
pnpm dev            # 监听模式构建
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
```

## 输出约定

- stdout：仅输出结构化 JSON（`console.log(JSON.stringify(...))`）
- stderr：进度、日志、诊断信息（`process.stderr.write(...)`）
- 退出码：0 = 成功，1 = 错误

## 编码规范

- 变量/函数：camelCase；常量：UPPER_SNAKE_CASE；类型：PascalCase
- 文件名：kebab-case（`workflow-list.ts`）
- Zod schema：PascalCase + Schema 后缀（`DefinitionSchema`）
- 不使用 `any`，用 `unknown` + 类型收窄
- 异步统一使用 async/await，不用 Promise 链
- 文件 I/O 使用同步 API（CLI 场景可接受）

## API 模式

- 认证：Cookie `token=<ACCESS_KEY>`
- 响应信封：`{err_code, err_msg, data}`，Zod 解析后返回 `data`
- 错误：抛出 `ApiError`（含 status、errCode）
- URL 构造：`${baseUrl}${prefix || "/api/backend"}${path}`

## 添加新命令

1. 在 `src/commands/` 创建处理函数
2. 在 `src/index.ts` 注册命令
3. 遵循输出约定：JSON → stdout，日志 → stderr
