# Storyboard 提示词标准模板

决定跑 storyboard 时（触发条件见 SKILL.md「Storyboard」），都用本模板。不要现编。

## 设计原则

Slot 分两层：

- **叙事层**（必填）：这个镜头讲什么、节拍链怎么走。由你/agent 翻译创作意图
- **调度层**（可选）：景别/视角/动势强调。**默认不填，交给模型**——模型从训练数据里自然会按动作强度和重点选景别。只在某格必须特殊处理（破题格、冲击格、情绪关键格）时写调度指令覆盖默认

这是本模板最核心的分工。混淆两层 → 用户变成摄影指导，storyboard 质量反而下降。

## 模板结构

固定骨架（**Frame**）承担：黑白线稿指令、网格布局、边框、阅读顺序、`@imageN` 主体引用协议、把调度权交给模型的指令。可替换槽位（**Slot**）承担：叙事和必要的调度覆盖。

只填 slot，不改 frame。

### Frame（原样复制，不要改）

```text
black and white manga-style storyboard sheet, {{GRID_LAYOUT}} grid layout ({{N_ROWS}} rows by {{N_COLS}} columns, {{K_PANELS}} panels total),
hand-drawn line art with variable line weight, allow speed lines, impact rays,
motion blur streaks and debris lines for dynamic panels, no shading no color no texture,
pure white panel backgrounds, thick black rectangular borders separating every panel.
Render {{K_PANELS}} distinct framed sketch panels arranged in a grid, NOT a single unified illustration.
Vary shot scale and camera angle across panels to match the dramatic weight of each beat — do NOT repeat the same framing.
{{SUBJECT_REF_BLOCK}}
The grid reads left-to-right then top-to-bottom as the time axis of one shot.
Shot intent: {{SHOT_INTENT}}
Do NOT draw arrows, labels, text callouts, numbers or "start / end" marks on the sheet — timing is conveyed purely by panel order and panel content.

{{BEAT_LIST}}
```

### Slot 列表

| Slot | 层 | 必填 | 内容 |
|------|----|------|------|
| `{{GRID_LAYOUT}}` / `{{N_ROWS}}` / `{{N_COLS}}` / `{{K_PANELS}}` | 技术 | ✅ | 按节拍数自动决定，见下表 |
| `{{SUBJECT_REF_BLOCK}}` | 引用 | 条件 | 有主体参考图时填，格式见下方 |
| `{{SHOT_INTENT}}` | 叙事 | ✅ | 一句话说清这个镜头讲什么，见下方 |
| `{{BEAT_LIST}}` | 叙事 | ✅ | 逐格节拍链，主谓宾 + 必要时含调度覆盖，见下方 |

### `{{GRID_LAYOUT}}` 选型

| 节拍数 K | 布局 | 画幅 | 适用场景 |
|---------|------|------|---------|
| 3-4 | `2x2` | 1:1 | 简短动作（起身、转身、一击） |
| 5-6 | `2x3` | 3:2 横排 | 主流叙事镜头 |
| 6 | `3x2` | 2:3 竖排 | 垂直推进（坠落、起立） |
| 7-9 | `3x3` | 1:1 | 长节拍镜头（连招、多阶段状态转变） |

节拍数 = 该镜头状态转变链的关键停驻点数。不要为了凑 2x3 强行拆节拍。

### `{{SUBJECT_REF_BLOCK}}` 格式

单主体：

```text
@image1 — subject reference for identity and body proportion only, render as black-and-white line-art, do not copy color or texture.
```

多主体（按参考图在 `input_spec.images[]` 中的顺序逐行写）：

```text
@image1 — [身份标签 A] reference for identity and body proportion only, render as black-and-white line-art, do not copy color or texture.
@image2 — [身份标签 B] reference for identity and body proportion only, render as black-and-white line-art, do not copy color or texture.
```

无主体参考图：整段 `{{SUBJECT_REF_BLOCK}}` 行删掉。

身份标签用最短的辨识性短语（`the cloaked figure` / `the child in red`），对应关系必须与 `input_spec.images[]` 数组顺序一一匹配，错位按 SKILL.md「身份核对」处理。

### `{{SHOT_INTENT}}` 格式

一句话，回答"这个镜头让观众感受到什么 / 发生了什么转变"。模型读到后会把每格向这个意图对齐。

- ✅ `from still standing to blade drawn — build of killing intent`
- ✅ `the child realizes the balloon is gone`
- ❌ `a person doing stuff`（没有转变，模型无从对齐）
- ❌ `dramatic and emotional`（抽象形容词，模型不理解）

### `{{BEAT_LIST}}` 格式

严格 K 行，每行一格，行首 `Panel N`。**默认只写叙事**——主语 + 动作 + 必要的环境事件。景别/视角不写，让模型决定。

```text
Panel 1: [主谓宾动作] + [必要时一句环境事件] + [必要时动势标识]
Panel 2: ...
...
Panel K: [落点]
```

#### 必填：主谓宾动作

主语 + 动词 + 可见的身体几何（`knees slightly bent`、`blade raised above head`、`one knee on ground`）。不写心理状态、不写情绪词。

#### 必填时机：环境事件

只在该节拍由环境事件触发或收尾时写（飞鸟掠过、雪落下、茶杯掉落）。无关环境不写。

#### 必填时机：动势标识

动作强烈的格（冲刺、劈斩、撞击）显式写：
- `speed lines radiating from arm`
- `impact rays around point of contact`
- `motion blur streaks trailing the cloak`
- `debris lines spraying upward`

静止格不用写（Frame 里已允许动势表达为空）。

#### 可选：调度覆盖

某格必须用特定景别/视角才能撑起叙事时，在行首括号里写：

```text
Panel 6 (extreme close-up + low angle): blade flashes out in a diagonal arc, speed lines along blade path
```

常见触发调度覆盖的场景：
- **破题格**（第 1 格）——要远景交代空间时加 `wide shot`
- **冲击格**——要特写放大重量时加 `close-up` 或 `extreme close-up`
- **反打 / 主观视角**——加 `over-the-shoulder` / `profile`
- **压迫感 / 崇高感**——加 `low angle` / `high angle`

**不要每格都覆盖**。覆盖 ≥半数格 = 失去默认 vary 指令的意义，退回到手工设计。模板的前提是信任模型的默认变化。

### 禁止

- 禁止在 Panel 里写运镜（`dolly in` / `pan left`）——运镜是正片 prompt 的职责
- 禁止跨格复述
- 禁止用否定表达（`no weapon visible` → 改成正面描述"双手空垂身前"）
- 禁止写情绪形容词（`she feels lonely` / `dramatic moment` 模型不理解）

## 填充示例

**场景**：6 节拍镜头，女剑客从静立到拔刀。

**决策**：K=6 → `2x3` 横排 3:2。

**填充后**：

```text
black and white manga-style storyboard sheet, 2x3 grid layout (2 rows by 3 columns, 6 panels total),
hand-drawn line art with variable line weight, allow speed lines, impact rays,
motion blur streaks and debris lines for dynamic panels, no shading no color no texture,
pure white panel backgrounds, thick black rectangular borders separating every panel.
Render 6 distinct framed sketch panels arranged in a grid, NOT a single unified illustration.
Vary shot scale and camera angle across panels to match the dramatic weight of each beat — do NOT repeat the same framing.
@image1 — the cloaked figure reference for identity and body proportion only, render as black-and-white line-art, do not copy color or texture.
The grid reads left-to-right then top-to-bottom as the time axis of one shot.
Shot intent: from still standing to blade drawn — build of killing intent.
Do NOT draw arrows, labels, text callouts, numbers or "start / end" marks on the sheet — timing is conveyed purely by panel order and panel content.

Panel 1 (wide shot): she stands alone on a bare wind-swept plain, cloak hanging straight, no motion lines.
Panel 2: she takes one step forward, cloak begins to lift from the left, faint motion streaks along the hem.
Panel 3: her right hand grips the sheathed blade at the hip, thumb pushing guard, gust of wind from left.
Panel 4: snow drifts across the frame, a crow flashes past in the background, she tilts her head slightly downward.
Panel 5: she turns her face toward camera, eyes narrow, blade still sheathed, held tension.
Panel 6 (close-up): blade flashes out in a diagonal arc, sharp speed lines radiating along the blade path, motion blur on the arm.
```

注意：只有 Panel 1（破题空间）和 Panel 6（冲击格）写了调度覆盖；中间 4 格完全交给模型——它会自然给出推进的景别变化（经验上通常是 full → medium → medium close-up 这类推进）。

## 反模式（生成效果立刻崩）

- ❌ 删掉 `{{BEAT_LIST}}` 段只留 frame → 经验观察：生成结果常偏离预期，倾向输出单张彩图
- ❌ Panel 里写"she feels lonely / dramatic moment" → 抽象情绪词模型不理解
- ❌ Panel 里写 `dolly in` / `pan left` → 运镜不是 storyboard 的职责
- ❌ Panel 里用否定表达 `no weapon visible` → 改成正面描述"双手空垂身前"
- ❌ 多主体但 `{{SUBJECT_REF_BLOCK}}` 没按 `input_spec.images[]` 顺序列出 → 身份错位
- ❌ **每格都写调度覆盖** → 退回手工设计，失去模型默认 vary 的好处。覆盖只在破题/冲击/关键情绪格用
- ❌ 在图面上画箭头或写"Start / End"文字 → frame 已禁止

## 回传给正片阶段

跑完的 `SB_N` 作为自己那个正片镜头的 `input_spec.images[]` 的一员，与主体参考图并列传入（维度正交，见 media-principles.md §1）。

正片 prompt 的权威链、骨架、Do/Don't 全部见 **SKILL.md「有资产时的正片 prompt」**。本文件不维护正片 prompt 格式。
