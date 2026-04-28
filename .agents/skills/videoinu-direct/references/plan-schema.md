# Plan 文件格式契约

Plan 由两个文件组成（同前缀，step key 关联）：
- `plans/<YYYY-MM-DD-HHmm>-<slug>.md` — 决策逻辑 + 执行日志
- `plans/<YYYY-MM-DD-HHmm>-<slug>.prompts.json` — prompt + input_spec（纯执行数据）

## `.md` 结构

```markdown
# Plan: <任务标题>

创建时间: <YYYY-MM-DD HH:mm>
状态: draft | approved | executing | done | failed
Prompt 数据: ./<同前缀>.prompts.json

## 一致性图（多镜头必填）

| 维度 | 共享范围 | 来源 | 类型 |
|------|---------|------|------|
| identity: <subject> | shot_01-04 | REF_IMG | ref image |
| style | all | style_lock | style_lock |

维度词汇：`identity: <subject>` | `style` | `composition: <场景>` | `motion` | `color_lighting`
来源类型：`ref image` | `first-frame chain` | `anchor text` | `motion ref` | `seed` | `style_lock`
规则：每行一维×一主体组 | 来源必须可追溯到 `input_spec` 或 Style Lock | `anchor text` 是最弱来源需标 `⚠️` | 单步 Plan 跳过

## 执行步骤
1. <动作> → prompt: `step_1` → 产物: <REF_IMG>
2. <动作> → prompt: `shot_01` → 输入: <REF_IMG> → 产物: <SHOT_01>

## 每步契约
- 步骤 1: mode=<t2v/i2v/f2v/r2v/首尾帧/image>, workflow=<def-id 或关键词>, prompt key=`step_1`
- 步骤 2: mode=<...>, workflow=<def-id>, prompt key=`shot_01`

## 执行日志
（执行阶段追加）
```

其他段落（意图、Style Lock、节奏自检、Pre-Plan 对齐等）是创作决策记录，执行时不读。

### 状态机

`draft → approved → executing → done | failed`

- `approved` → `executing`：执行开始
- 每步完成只追加执行日志，不改状态
- 全部完成 → `done`；不可恢复 → `failed`

## `.prompts.json` Schema

**只放执行必须的数据**。创作侧元数据（事件描述、风格基调等决策记录）留在 Plan `.md` 或作为写 prompt 的思考过程，不进 JSON。

骨架：

```json
{
  "steps": {
    "step_1": {
      "type": "image",
      "input_spec": {
        "prompt": "最终 prompt",
        "<slot>": "<值>"
      }
    },
    "shot_01": {
      "type": "image-to-video",
      "input_spec": {
        "prompt": "...",
        "image": "<对 REF_IMG 的引用>"
      }
    }
  }
}
```

### 字段读写

| 字段 | 行为 |
|------|------|
| `steps[key].type` | 读：决定工作流类型 |
| `steps[key].input_spec` | 读：`videoinu run --input-spec` 的输入。值可以是本地路径 / URL / 文本 / JSON |
| `steps[key].result` | 写：执行成功后追加一个 outputs 数组（文件化结构，见下） |

`result` 结构（由 `videoinu-cli` 执行时写入）：

```json
{
  "outputs": [
    {"slot_name": "image", "asset_type": "image", "local_path": "plans/out/ref-img_image_001.png", "remote_url": "..."},
    {"slot_name": "caption", "asset_type": "text", "content": "..."}
  ]
}
```

### Step key 命名约定

`.prompts.json` 的 `steps` key 和 `.md` 「执行步骤」里用同一套命名，让读者一眼看出每步的 pre-production 层级：

| Key | 含义 | 何时用 |
|-----|------|-------|
| `step_N` | 通用编号步骤 | 没有明确层级分类的素材生成步骤 |
| `step_cs_M` | 主体 M 的设定图（character/concept sheet） | 跑设定图时（触发判据见 SKILL.md「Pre-production 两层资产」） |
| `step_sb_N` | 镜头 N 的分镜图（storyboard） | 跑分镜图时 |
| `shot_N` | 正片镜头 N | 所有正片 video 产出 |

`M` 按主体编号（`cs_1` / `cs_2`），`N` 按镜头编号（`sb_01` / `shot_01`）。同一个 N 下的 `sb_N` 和 `shot_N` 一一对应——`sb_N` 只传回 `shot_N`，不要跨镜头复用。简单单镜头任务可以只用 `step_N` + `shot_01`，不强制套完整层级。

### 步骤间引用

direct 只负责：

- 在 `.md`「执行步骤」里用全大写命名产物（`REF_IMG`、`SHOT_01`），后续步骤写"输入: <REF_IMG>"
- 在 `.prompts.json` 的 `input_spec` 里标出哪个槽位要引用哪个前序产物名

**具体怎么落到文件路径由 `videoinu-cli` skill 负责**——它执行上一步时用 `--download-prefix <产物名>` 把产物命名成可追溯的本地文件，然后在下一步前把文件路径字符串填进 `input_spec`。direct 不需要写任何 ID、引用语法或占位符。

## 中断恢复

找最新 `状态: executing` 的 Plan → 跳过已有 `result` 的步骤 → 从第一个缺 `result` 的继续。前序 `result` 异常时停下询问。

## 硬约束

- 没读 Plan 两个文件不执行
- 状态不是 `approved` 或 `executing` 不执行
- 前序产物缺失（上一步 `result` 空 / 对应 `local_path` 不存在）→ 停下报错
- 执行中不改 prompt / input_spec；要改先停下改 Plan 再让用户确认
