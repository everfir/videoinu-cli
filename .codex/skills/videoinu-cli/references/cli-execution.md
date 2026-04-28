# 用 videoinu CLI 执行

所有子命令都支持 `--help`。本文件只规定执行顺序和不允许犯的错误。

## 固定顺序

每次跑 workflow 都走：找工作流 → 看 schema → 映射输入 → 估价或直跑 → 查状态/下载 → 拿到 `core_node_id`（后续命令如需引用前序产物，用 `{type:"core_node", core_node_id:"..."}`）。

## 1) 找工作流

`--search` 是**子串匹配**（匹配整条定义 JSON），不是语义搜索：

- 用单个短关键词（`image`、`upscale`、`seedance`、`music`），不要用 `"text to image"` 这类短句
- 结果太多时用 `--group` 或 `--function <generate|...>` 进一步过滤
- 列表有缓存，必要时 `--refresh`
- 用户已给 `definition id` 时跳到 describe

## 2) 看 schema

`videoinu workflow describe <def-id>` 必先跑。只信 `input_schema[].name` / `data_type` / `required` / `multiple` / `min_count` / `max_count`。`--input-spec` 的 key 只能来自 `input_schema[].name`。

## 3) 映射输入

`--input-spec` 是高层 JSON，key 必须匹配 `input_schema[].name`。支持的值写法详见 `videoinu run --help`，这里只列规则：

- schema 的 `multiple=true` 时，值必须是数组
- 本地文件路径可直接作为字符串传入，CLI 自动上传
- 同一 reference 要在多次 run 之间复用时，先 `videoinu upload` 拿 `core_node_id`，再用 `{type:"core_node", core_node_id:"..."}`
- `data_type=json` 的 slot 优先传结构化对象/数组，不要序列化成字符串
- URL 输入必须显式带 `asset_type`（image/video/audio）

## 4) 执行策略

- `run` 本身会**自动估价**（余额不足会直接报错），不需要手动加 `--estimate` 做额度检查
- `--estimate` 的语义是**只估价不执行**，用来给用户报价预览；正式跑时不要加
- 视频工作流默认 `--wait`，shell 超时设足够长（至少 600000ms），或用 run_in_background
- 大批量变体用 `--count`
- Seedance 相关工作流 CLI 会自动识别并走 ark review；若识别失败或被跳过，用 `videoinu ark-asset submit <core-node-id> --wait` 兜底
- 跑前想知道账户余额：`videoinu credits`

```bash
videoinu run <def-id> \
  --input-spec '{"prompt":"...","image":"./ref.png"}' \
  --wait --download-dir ./out     # 加 --estimate 则只报价不执行
```

## 5) 状态与下载

```bash
videoinu status <instance-id> --outputs --poll 300 --download-dir ./out
```

如果 `run --wait` 已带 `--download-dir`，完成后会自动下载。

## 输出命令时的硬约束

- 没有 `describe` 结果，不输出最终 `run` 命令
- 没有确认 slot 名，不猜
- stdout 是 JSON，stderr 是日志，不混用
- 长任务要说明耗时范围：图像 1-5 分钟，音乐/音频 2-5 分钟，视频 5-20 分钟
