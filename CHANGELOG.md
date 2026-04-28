# Changelog

本项目的所有显著变更都会记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-04-28

### 新增

- 首个公开版本
- `auth` / `config` / `doctor` / `workflow` / `run` / `status` / `upload` / `download` / `credits` 命令
- `run --wait` 阻塞执行并自动下载产物到本地
- `--input-spec` 支持本地文件、远程 URL、内联文本/JSON 自动分派
- MD5 缓存，同文件不重复上传
- 面向 AI agent 的输出契约：stdout 纯 JSON、stderr 日志、退出码标准化

[Unreleased]: https://github.com/everfir/videoinu-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/everfir/videoinu-cli/releases/tag/v0.1.0
