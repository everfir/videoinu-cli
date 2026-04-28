# Changelog

本项目的所有显著变更都会记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.1] - 2026-04-28

### 变更

- `workflow list` 移除 `--tag` 选项（实际一直没生效）
- 内部简化：合并 core_node 创建辅助函数、去除 ark 审核链路的冗余缓存读

### 安全

- 通过 pnpm overrides 将 `postcss` 升级到 `>=8.5.10`，修复 GHSA-qx2v-qp2m-jg93（仅 devDependency）

## [0.1.0] - 2026-04-28

### 新增

- 首个公开版本
- `auth` / `config` / `doctor` / `workflow` / `run` / `status` / `upload` / `download` / `credits` 命令
- `run --wait` 阻塞执行并自动下载产物到本地
- `--input-spec` 支持本地文件、远程 URL、内联文本/JSON 自动分派
- MD5 缓存，同文件不重复上传
- 面向 AI agent 的输出契约：stdout 纯 JSON、stderr 日志、退出码标准化

[Unreleased]: https://github.com/everfir/videoinu-cli/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/everfir/videoinu-cli/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/everfir/videoinu-cli/releases/tag/v0.1.0
