# 用 videoinu CLI 执行

所有子命令都支持 `--help`。本文件只规定执行顺序和不允许犯的错误。

## 固定顺序

每次跑 workflow 都走：找工作流 → 看 schema → 映射输入 → 估价或直跑 → 拿到本地产物文件。

**对外没有 ID 概念**。所有资源的身份都是本地文件路径；上传、审核、缓存全部 CLI 内部消化。

## 1) 找工作流

`--search` 是**子串匹配**（匹配整条定义 JSON），不是语义搜索：

- 用单个短关键词（`image`、`upscale`、`seedance`、`music`），不要用 `"text to image"` 这类短句
- 结果太多时用 `--group` 或 `--function <generate|...>` 进一步过滤
- 列表有缓存，必要时 `--refresh`
- 用户已给 `definition id` 时跳到 describe

## 2) 看 schema

`videoinu workflow describe <def-id>` 必先跑。只信 `input_schema[].name` / `data_type` / `required` / `multiple` / `min_count` / `max_count`。`--input-spec` 的 key 只能来自 `input_schema[].name`。

## 3) 映射输入

`--input-spec` 是 JSON，key 必须匹配 `input_schema[].name`。值会被自动识别：

- 字符串且是**存在的本地路径** → 作为文件上传
- 字符串以 `http(s)://` 开头 → CLI 内部下载再上传（asset_type 从 slot 推断）
- 其他字符串 → 作为文本
- 对象且是 `{"type":"text"|"json"|"file"|"url", ...}` → 显式形式
- 对象/数组 + slot `data_type=json` → 作为 JSON
- schema 的 `multiple=true` 时，值必须是数组

**跨 step 复用前序产物的唯一写法**：把上一步产物的 `local_path`（run/status 输出里的字段）**直接作为字符串**填到下一步的 input-spec 里。CLI 自动重新上传（相同文件 MD5 缓存命中，不会真的重传）。

```json
// 上一步 outputs: [{"slot_name":"image","asset_type":"image","local_path":"./out/hero_image_001.png",...}]
// 下一步 input-spec：
{ "prompt": "...", "image": "./out/hero_image_001.png" }
```

## 4) 执行策略

- `run` 本身会**自动估价**（余额不足直接报错），不必手动加 `--estimate` 做额度检查
- `--estimate` 是**只估价不执行**，给用户报价用；正式跑时不要加
- 视频工作流默认 `--wait`，shell 超时设足够长（至少 600000ms），或用 run_in_background
- 大批量变体用 `--count`
- Seedance 系列工作流 CLI 会**自动做内容审核**，不需要任何额外操作
- 跑前想知道账户余额：`videoinu credits`

```bash
videoinu run <def-id> \
  --input-spec '{"prompt":"...","image":"./ref.png"}' \
  --wait --download-dir ./out --download-prefix shot1-hero
# 加 --estimate 则只报价不执行（此时无需 --wait / --download-*）
```

## 5) 状态与下载

`run --wait` 已带下载参数时会自动下载，不用再跑 status。

需要单独查状态（比如跑 `--wait` 超时后恢复）：

```bash
videoinu status <instance-id> --poll 300 \
  --outputs --download-dir ./out --download-prefix shot1-hero
```

## 下载是强制的（硬约束）

**产物一律落盘**——`run --wait` 和 `status --outputs` 都必须显式传 `--download-dir` + `--download-prefix`，未传 exit 1。没有办法"只要 remote URL 不下载"。

**命名规则**：

- `run` / `status` 的 outputs：`<prefix>_<slot-slug>_<idx>.<ext>`（slot 名自动拼接）
- `download <urls...>`（顶层命令，极少用）：`<prefix>_<idx>.<ext>`

`--download-prefix` / `--prefix` **必须有语义**，描述这批文件是什么（`hero-portrait`、`shot1-storyboard`、`bgm-intro`），不要用 instance_id、UUID、时间戳、`out` / `result` 这种无信息词。CLI 会做 slugify（小写、非字母数字转 `-`）。

## 输出结构（agent 需要理解）

`run --wait` 或 `status --outputs` 完成后，每个 slot 的 output 形如：

```json
{
  "slot_name": "image",
  "asset_type": "image",
  "local_path": "./out/shot1-hero_image_001.png",
  "remote_url": "https://...",
  "content": null
}
```

- 二进制资产（image / video / audio / pdf）：`local_path` 必有，`remote_url` 通常有，`content` 没有
- 文本 / JSON：`content` 有，`local_path` 和 `remote_url` 通常没有
- 下游 step 复用时，**只读 `local_path` 或 `content`**——`remote_url` 只用于分享给人

## 硬约束（输出命令时）

- 没有 `describe` 结果，不输出最终 `run` 命令
- 没有确认 slot 名，不猜
- stdout 是 JSON，stderr 是日志，不混用
- 长任务要说明耗时范围：图像 1-5 分钟，音乐/音频 2-5 分钟，视频 5-20 分钟

## Plan 执行契约（videoinu-direct 的消费者侧）

`videoinu-direct` skill 在 Plan 里用全大写名称（`REF_IMG`、`SHOT_01`）标记产物。**本 skill 负责把这些名称落地到文件路径上**：

- 每一步 `run --download-prefix <name>`，`<name>` 由 direct 在 Plan 里声明的产物名决定（slugify 后作为前缀）
- 一步完成后，**把该步的 outputs 数组（含 `local_path` / `content`）回填到 Plan step 的 `result` 字段**
- 下一步如果 Plan 里写"输入: <REF_IMG>"，本 skill 在 `input_spec` 里用**上一步 `result[i].local_path`** 作为值
- `result` 缺失 → 停下报错，不要凭空生成或跳过

direct 侧不应出现任何平台 ID 概念——只需要在 `.md` 里说"这步产物叫 X，下一步用 X 作为 image 输入"，本 skill 把 X 翻译成具体路径。
