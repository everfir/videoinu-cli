# 分镜图提示词标准模板

决定跑分镜图时（触发条件见 SKILL.md「Pre-production 两层资产」），都用本模板。不要现编。

## 设计原则

Slot 分两层：

- **叙事层**（必填）：这个镜头讲什么、节拍链怎么走。由你/agent 翻译创作意图
- **调度层**（可选）：景别/视角/动势强调。**默认不填，交给模型**——模型从训练数据里自然会按动作强度和重点选景别。只在某格必须特殊处理（破题格、冲击格、情绪关键格）时写调度指令覆盖默认

这是本模板最核心的分工。混淆两层 → 用户变成摄影指导，分镜图质量反而下降。

## 格间连续性不会自动成立

分镜图生成的本质是「模型独立渲染 K 张画面再拼进一张多面板图」。任何你希望跨格保持一致的维度——主体朝向 / 行进方向、光源方向、时间流向、画面内相对位置、景别推进节奏——**都不会自动成立**，必须在 prompt 里显式声明，否则每格会各自独立构图。

最常见的崩盘症状是方向翻转：过弯镜头里同一辆车 6 格中车头一会朝左一会朝右、出现纯尾部视角；双人对话里两人相对位置左右互换；行走镜头每格主体都正对镜头站着。读下来不是"连续过程"而是"在原地抖动"。

识别方法：写完 `{{SHOT_INTENT}}` 和 `{{BEAT_LIST}}` 后自问——**这个镜头里，有哪些东西在 K 格之间必须保持一致？** 如果有（行进方向、光源、群像走位、时间流等），就在 `{{SHOT_INTENT}}` 后面或 `{{BEAT_LIST}}` 的每格里显式钉住。没有就不写，别硬造。

这不是一个固定 slot，因为"需要锁什么"完全由镜头性质决定。固定下来会变成套模板；保留判断，才是模板的一部分。

## 服务正片 prompt

分镜图不是独立插画，必须服务后续 `shot_N` 的 video prompt。写 `step_sb_N` 前先做 handoff 判断：

- `sb_N` 要锁：关键状态链、主转折点、panel 权重、阅读顺序、连续性锚点、必要的构图/姿态
- `shot_N` 要补：最终色彩/材质/光照、真实运动质感、镜头运动、粒子/流体/惯性、节奏压缩或释放

分镜图 prompt 里不要为了好看塞入后续视频无法消费的装饰格。每个 panel 都要回答一个问题：它会让正片 prompt 更清楚地执行哪个状态变化？如果答案只是"画面更丰富"，删掉或合并。

## 模板结构

固定骨架（**Frame**）承担：黑白线稿指令、布局、边框、阅读顺序、`@imageN` 主体引用协议、连续性锚点。可替换槽位（**Slot**）承担：叙事和必要的调度覆盖。

只填 slot，不改 frame。

### Frame（原样复制，不要改）

```text
black and white manga-style storyboard sheet, {{LAYOUT_SPEC}},
hand-drawn line art with variable line weight, allow speed lines, impact rays,
motion blur streaks and debris lines for dynamic panels, no shading no color no texture,
pure white panel backgrounds, thick black borders separating every panel.
Render {{K_PANELS}} framed sketch panels as one continuous action beat, not {{K_PANELS}} unrelated illustrations.
Use repeated visual anchors across every panel: {{CONTINUITY_ANCHORS}}.
All panels happen in the same space during the same few seconds. Do not change character design, location, weather, lighting direction, or screen direction between panels.
{{SUBJECT_REF_BLOCK}}
Reading order: {{READING_ORDER}}.
Shot intent: {{SHOT_INTENT}}
Do NOT draw arrows, labels, text callouts, numbers or "start / end" marks on the sheet — timing is conveyed purely by panel order and panel content.

{{BEAT_LIST}}
```

### Slot 列表

| Slot | 层 | 必填 | 内容 |
|------|----|------|------|
| `{{LAYOUT_SPEC}}` / `{{K_PANELS}}` / `{{READING_ORDER}}` | 技术 | ✅ | 先定 K，再按权重和可读性选 regular / bento / strip / contact sheet，见下方 |
| `{{CONTINUITY_ANCHORS}}` | 连续性 | ✅ | 同一动作链中必须跨格保持一致的视觉锚点，见下方 |
| `{{SUBJECT_REF_BLOCK}}` | 引用 | 条件 | 有主体参考图时填，格式见下方 |
| `{{SHOT_INTENT}}` | 叙事 | ✅ | 一句话说清这个镜头讲什么，见下方 |
| `{{BEAT_LIST}}` | 叙事 | ✅ | 逐格节拍链，主谓宾 + 必要时含调度覆盖，见下方 |

### `{{LAYOUT_SPEC}}` 选型

先判断节拍密度和权重结构，不要机械套 `K=6 -> 2x3`，也不要把 bento 当默认高级答案。布局服务于**读者能否看懂状态链**。

`K` 是关键状态数，不是秒数，也不是上限。短动作常见 3-6；复杂连招、机械过程、舞蹈/打斗/运动细节可以到 10-16。K 越高，每格越小，越容易丢动作信息；如果单格已经看不清接触点、重心、偏航角或表情，就拆成多张 storyboard，或合并次要 beat。

| 动作结构 | 推荐布局 | `{{LAYOUT_SPEC}}` 写法 |
|---------|---------|-----------------------|
| 节拍权重接近，读法线性 | regular grid | `regular 2x3 grid layout, 6 panels total` / `regular 4x4 contact-sheet layout, 16 panels total` |
| 有 1-2 个主转折点，其余是支撑细节 | bento grid | `bento storyboard layout, 9 panels total: two dominant panels for the main turning points, with seven smaller support panels around them` |
| 运动方向单一且强调轨迹 | strip / cascade | `horizontal strip storyboard layout, 8 panels total` / `vertical cascade storyboard layout, 7 panels total` |
| K 很高但每格只需记录状态，不追求画面冲击 | contact sheet | `dense storyboard contact sheet, 12 panels total, evenly spaced readable panels` |

节拍数 = 该镜头状态转变链的关键停驻点数，与镜头类型无关。不要为了凑固定布局强行拆节拍，也不要为了 bento 硬塞装饰格。

可读性判据：
- `K <= 6`：可以强调冲击格和构图节奏
- `K = 7-12`：优先保证动作因果清楚，少写复杂背景
- `K = 13-16`：更适合动作研究 / contact sheet；每格优先保留主体、接触点、重心和方向，不要让背景和镜头花样挤掉动作信息
- `K > 16`：默认拆成多张 storyboard，除非用户明确要缩略总览

`{{READING_ORDER}}` 也要随布局写清楚：

- regular grid：`left-to-right then top-to-bottom as the time axis of one shot`
- bento grid：`read the prompt Panel order in visual order: support panels lead into the dominant panel, then continue to the release panel`（不要让图面出现数字）
- strip / cascade：`read continuously from left to right` / `read continuously from top to bottom`
- contact sheet：`read left-to-right then top-to-bottom as a compact action study`

### `{{CONTINUITY_ANCHORS}}` 格式

列出 3-6 个跨格必须保持一致的视觉事实。没有这些锚点，模型会把每格画成同主题独立插图。

```text
same runner silhouette and dark rain jacket, same rooftop edge, same city skyline direction, same rain angle, same cold backlight
```

写法原则：
- ✅ 写同一主体、同一空间、同一行进方向、同一光源/天气、同一道具/接触点
- ✅ 动作类 storyboard 必须写 screen direction，例如 `movement always reads left-to-right`
- ❌ 不要写抽象词（`cinematic continuity` / `emotional consistency`）
- ❌ 不要写会鼓励换图的词（`all panels visually distinct`、`each panel a different scene`）

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

身份标签写法（最短辨识性短语）和 `input_spec.images[]` 顺序错位的处理见 SKILL.md「多图必写用途说明」「身份核对」。

### `{{SHOT_INTENT}}` 格式

一句话，回答"这个镜头让观众感受到什么 / 发生了什么转变"。转变可以是叙事性的（动作、情感）也可以是非叙事的（物理状态、时间、环境）。模型读到后会把每格向这个意图对齐。

- ✅ `from still standing to blade drawn — build of killing intent`（叙事：动作爆发）
- ✅ `the child realizes the balloon is gone`（叙事：情感反转）
- ✅ `espresso crema forms and stabilizes on the surface`（非叙事：产品物理状态）
- ✅ `dusk slowly deepens into full night over the skyline`（非叙事：时间/氛围流逝）
- ❌ `a person doing stuff`（没有转变，模型无从对齐）
- ❌ `dramatic and emotional`（抽象形容词，模型不理解）

### `{{BEAT_LIST}}` 格式

严格 K 行，每行一格，行首 `Panel N`。`Panel N` 是给模型理解顺序的 prompt 文本，不允许画到图面上。**默认只写叙事**——主语 + 动作 + 必要的环境事件。景别/视角不写，让模型决定。

```text
Panel 1: [主谓宾动作] + [必要时一句环境事件] + [必要时动势标识]
Panel 2: ...
...
Panel K: [落点]
```

#### 必填：主谓宾动作

主语 + 动词 + **可见的物理状态**——能被画出来、能被下一格的状态对比出来的量。不写心理状态、不写情绪词。

不同主体的"可见物理状态"词汇不同，不要把人体示例套到所有主体上：

| 主体类型 | 可见物理状态示例 |
|---------|----------------|
| 人体 / 生物 | 身体几何（`knees slightly bent`、`blade raised above head`、`one knee on ground`）、视线方向、手部接触点 |
| 机械 / 载具 | 车身相对行进方向的偏航角、俯仰角（重心前倾/后仰）、轮胎抓地状态（咬合 / 打滑 / 离地）、方向盘转角与实际滑动方向的关系、结构形变（悬挂压缩、尾翼攻角） |
| 流体 / 粒子 | 液面倾斜角、喷溅方向与密度、表面张力断裂时机、气泡/烟柱的方向与弯曲度 |
| 布料 / 柔体 | 皱褶走向、迎风弯曲方向与曲率、受力点与传导路径 |
| 光 / 环境 | 光源方向变化、阴影长度与角度、雾/雨/雪的密度与入射角 |

#### 状态差原则

节拍推进 ≠ 换个角度看同一个动作。**相邻两格之间至少要有一个可见物理状态量发生变化**（偏航角从 0° 到 30°、液面从水平到倾斜、身体重心从前到后），否则模型会把这两格画成"同一状态的两个漂亮角度"——这是分镜图最常见的崩盘方式。

写 `{{BEAT_LIST}}` 前自查：把每格的主谓宾抽出来排一列，逐对比较相邻格——如果第 N 格和第 N+1 格的**物理状态描述词**能互换而不影响理解，说明这两格没有时序差，合并或重写。

**机械/载具主体尤其要警惕**：描述"入弯 / 出弯 / 转向"这类叙事动词时，模型容易输出"同一台车在不同背景前的漂亮静照"。必须把叙事动词翻译成**物理量的变化**（车身偏航、轮胎烟雾、悬挂压缩差），模型才能读出"这是时序不是画册"。

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

## 填充示例

**场景**：6 节拍镜头，女剑客从静立到拔刀。

**决策**：K=6，权重均匀 → regular `2x3` 横排 3:2。

**填充后**：

```text
black and white manga-style storyboard sheet, regular 2x3 grid layout, 6 panels total,
hand-drawn line art with variable line weight, allow speed lines, impact rays,
motion blur streaks and debris lines for dynamic panels, no shading no color no texture,
pure white panel backgrounds, thick black borders separating every panel.
Render 6 framed sketch panels as one continuous action beat, not 6 unrelated illustrations.
Use repeated visual anchors across every panel: same cloaked figure silhouette, same wind direction from left, same bare plain horizon, same black cloak shape.
All panels happen in the same space during the same few seconds. Do not change character design, location, weather, lighting direction, or screen direction between panels.
@image1 — the cloaked figure reference for identity and body proportion only, render as black-and-white line-art, do not copy color or texture.
Reading order: left-to-right then top-to-bottom as the time axis of one shot.
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

### 布局决策速查

- regular grid：用在每个 beat 都差不多重要时，稳定、清楚、不抢戏
- bento grid：用在有明确主转折点时，大格给转折点，小格给前因后果；没有主转折就不要用
- strip / cascade：用在运动方向或重力方向本身是主叙事时
- contact sheet：用在 K 很高、目的是研究动作连续性而不是产出一张漂亮分镜图时

## 反模式（生成效果立刻崩）

- ❌ 删掉 `{{BEAT_LIST}}` 段只留 frame → 经验观察：生成结果常偏离预期，倾向输出单张彩图
- ❌ Panel 里写"she feels lonely / dramatic moment" → 抽象情绪词模型不理解
- ❌ Panel 里写 `dolly in` / `pan left` → 运镜不是分镜图的职责
- ❌ 跨格复述同一动作、或只用叙事动词（`入弯 / 转向 / 救车`）不带物理状态差 → 模型把多面板当成"一主体的多张漂亮画册"来画，相邻格只换景别/角度而主体状态不变。诊断法：抽出每格主谓宾排列，若相邻格状态词可互换则已崩。修法见「状态差原则」
- ❌ 默认把 K 映射成固定网格，且加 `Keep all panels visually distinct` / `Vary shot scale and camera angle` → 模型会强化每格独立性，动作链容易断。先看节拍权重和可读性，再选布局
- ❌ bento grid 只写"自由排版"但不写 dominant panel 承载什么动作功能 → 模型会把布局做成装饰拼贴，主动作不突出
- ❌ Panel 里用否定表达 `no weapon visible` → 改成正面描述"双手空垂身前"
- ❌ 多主体但 `{{SUBJECT_REF_BLOCK}}` 没按 `input_spec.images[]` 顺序列出 → 身份错位
- ❌ **每格都写调度覆盖** → 退回手工设计，失去模型默认 vary 的好处。覆盖只在破题/冲击/关键情绪格用
- ❌ 在图面上画箭头或写"Start / End"文字 → frame 已禁止

## 回传给正片阶段

`sb_N` 作为 `shot_N` 的 `@image` 传入，协作链见 [media-principles.md §4](media-principles.md#4-pre-production-流水线设定图--分镜图--正片)。正片 prompt 必须显式说明如何消费这张分镜图：读它的 action beats / composition weights / continuity anchors / reading order，再补镜头节奏和 motion texture；不要逐格复述，也不要让模型把分镜页本身画进正片。
