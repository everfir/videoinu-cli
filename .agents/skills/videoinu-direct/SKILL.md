---
name: videoinu-direct
description: >
  Videoinu 创作层 skill：prompt engineering、AI 导演与多步 Plan 编排。
  把创作意图压成可生成的 prompt / 分镜 / 多镜头 Plan，并按步骤调 `videoinu` CLI 执行。
  触发场景：优化图片/视频 prompt、多镜头分镜规划、参考图/首帧策略、关键帧合成、
  失败结果重写、跑 Plan 两件套、中断恢复、风格基调、镜头节奏、运镜设计、
  主体一致性方案、i2v/f2v/t2v 模式选择、设定图生成、
  分镜图生成与引用、pre-production 流水线规划。
  即使用户只说"帮我做个视频/图片"而没提 prompt，只要涉及 Videoinu 平台的创作决策就应触发。
---

# Videoinu Direct — 创作 + 编排

创作（把意图变成 prompt / 分镜 / Plan）+ 编排（按 Plan 逐步调 `videoinu` CLI）。CLI 命令细节由 `videoinu-cli` skill 负责，本 skill 决定"每一步跑什么、传什么 input-spec"。

**对用户输出中文**；**发给模型的内容**（prompt 正文、`.prompts.json` 字段值、`@imageN — ...` 说明）默认英文。

---

## 核心原则

- **写画面，不写感觉**：抽象情绪词（"孤独感""史诗感"）替换成具体画面
- **优先用摄影/影视通用术语**，自造组合短语对生成效果没帮助。反例覆盖三类：动作型（`near-frozen impact frame`）、运镜型（`steady forward track`）、氛围型（`melancholic golden hour haze`）——禁的是"自造组合"本身，不是这几个具体词
- **资产 > 文字**：能用参考图/首帧锁定的维度不要用文字重复
- **控制越少越好**：控 what happens / 运镜 / 起止状态 / 主体锚点；不控时序编排、物理细节——模型会处理。默认描述式 prompt（详见 [video-guide.md](references/video-guide.md)）
- **一次只解决一个主矛盾**，迭代只改一维
- 视频 prompt 尽量写运镜（类型 + 速度/程度 + 方向或景别变化）；定镜例外

---

## 参考图

`@imageN` / `@videoN` / `@audioN` 是**给生成模型读的字面量 token**。`input_spec.images[N-1]` 按顺序绑定（CLI 层处理），prompt 文本里原样保留不展开。r2v 模式有 `@image` 参数时，不要在文字里再写一遍主体描述。

### 身份核对（写 prompt 前强制）

错位一位 → 主体丢失或融合，改 prompt 救不回。

1. **Read 每张参考图**——不凭文件名、目录、上下文推断
2. 把 `@imageN → 视觉摘要` 写进 Plan `.md` 自查。单主体 prompt 正文不写身份特征（`@image1 — subject reference` 已足够）；多主体需要区分"谁做什么"时用**最短的身份标签**（`the cloaked figure` / `the child in red`）

### 多图必写用途说明

多图并存时每个 `@imageN` 后紧跟一句用途说明，同一维度只由一张图承载——每张图只承担 [media-principles.md §1 资产本体](references/media-principles.md#1-资产本体) 表里的一个维度。按实际资产类型写用途，常见样式：

- ✅ 主体 ref：`@image1 — subject reference — identity and appearance defined by this image`
- ✅ 分镜图：`@image2 — storyboard reference for composition and shot framing only; render in full photorealistic color per style lock`
- ✅ 首帧：`@image2 — first frame — the video must start from this exact frame`
- ✅ motion ref：`@image2 — motion reference — copy the trajectory and pacing only, do not copy subject or scene`
- ✅ 风格 ref：`@image2 — style reference for color palette and lighting only, do not copy subject`
- ❌ 只写 `@image1 @image2`（维度边界丢失）
- ⚠️ 否定表达只用于锁定维度边界（`do not copy line-art style` = "只取构图不取画风"）；不要用于画面主体——改成正面描述主体实际呈现的状态

---

## 视觉判断纪律

做视觉判断前先让用户确认图是预期的那张；下结论时引用文件路径 + 具体视觉特征 2-3 条，不写"漂了 / 对齐了"这种不可追溯的词。读错一次立刻切换到证据化表达（只报特征，不下结论），继续错就把图交还用户主判。

---

## Plan → Execute

### 何时触发

任何需要 ≥2 个 run 的任务（多镜头、多变体、带上游自补素材）走 Plan 两件套；单镜头、单张图直接输出最终 prompt。

### 流程

1. **Pre-Plan 对齐**：检查创作意图完整性，有缺口一次性列出开放式问题（≤3 个）。素材缺口（参考图/首帧/分镜）自补不打断，Plan 里先列一步生成；简单明确的任务跳过对齐
2. **写 Plan**：生成 `.md`（决策 + 执行日志）和 `.prompts.json`（prompt + input_spec）两个文件（命名与格式见 [plan-schema.md](references/plan-schema.md)）。**风格基调**（艺术风格、色调、材质、光照）记录在 `.md` 里，所有镜头/变体原样复用；**首个 image 产物即是 style 验证点**，不做文字 review
3. **Execute**：按 Plan 逐步调 `videoinu run`（`@imageN` 原样保留不替换）。步骤间引用与回填由 CLI skill 处理

### Pre-production 两层资产：设定图 + 分镜图

正片 video 的两个 image 前置产物——主体层的**设定图**（Subject Sheet）和镜头层的**分镜图**（Storyboard）——维度正交、按需触发，都不是默认必做。锁维度与形态见 [media-principles.md §4](references/media-principles.md#4-pre-production-流水线设定图--分镜图--正片)。

"主体"不局限于角色——场景、道具、载具、生物、虚构物体都算。

**设定图**

- **用**：同一主体跨多镜头复用、自造/虚构主体没有现成 ref、单张 ref 信息不足（缺角度/状态/服装变化）、场景需要稳定空间布局
- **不用**：一次性镜头、现有单张 ref 已够用、用户已直接指定权威照片作为 ref

**分镜图**

- **用**：≥2 镜头的叙事序列、含多节拍动作链的单镜头、跨镜头构图需要人工控制
- **不用**：简单延续动作（走路、摇头、风吹）、纯气氛/风格探索、f2v 首帧已强锚定、概念未定型

**Handoff 纪律**：分镜图 prompt 和正片 video prompt 是一组 contract，不是两份独立创作——`sb_N` 和 `shot_N` 的分工见 [storyboard-template.md「服务正片 prompt」](references/storyboard-template.md#服务正片-prompt)。两者都是 image 生成，会失败、会作为额外约束源与首帧/prompt 打架，不要当默认安全网。

规格、协作链、step key 命名见 [media-principles.md §4 Pre-production 流水线](references/media-principles.md#4-pre-production-流水线设定图--分镜图--正片) 和 [§5 分镜图规格](references/media-principles.md#5-分镜图规格)；分镜图 prompt 模板见 [storyboard-template.md](references/storyboard-template.md)。

### 输出格式

**单图/单镜头**：

```
Prompt:
[最终 prompt]

Negative Prompt:          ← 仅 image 或明确需要时
[只写真实失败项]
```

**Plan 两件套**：

> Plan 已写好：`plans/<前缀>.md` + `.prompts.json`
> [2-3 句摘要]
> 确认后开始执行。

---

## 有资产时的正片 prompt

### 写作顺序

传入的每种资产各自锁住一些维度（完整映射见 [media-principles.md §1 资产本体](references/media-principles.md#1-资产本体)）；prompt 文字只补**所有传入资产都没覆盖的维度**。

写 prompt 的顺序：**先列传入资产 → 查 §1 它们各锁什么 → prompt 只补剩余维度**，而不是"我想让它这样 → 写下来"。

### 骨架

```text
[风格基调 — 1 句：色调 + 光照 + 画面质感/胶片语言]

@image1 — ...（按资产类型写用途说明）
@image2 — ...
（按实际传入的图数量展开，没有 @image 的镜头跳过这段）

[Motion texture — 2-4 短句：资产锁不住的运动质感，如惯性、反光、粒子重量、流体行为、呼吸雾气]

[可选节拍过渡 — 仅当镜头节拍类型需要显式引导；写节奏不写画面]
```

### 常见资产组合样例

**主体 ref + 分镜图**（多镜头叙事 / 动作戏典型）：

```text
@image1 — [subject tag] subject reference — identity and appearance are defined by this image, do not substitute
@image2 — storyboard reference. Use the panel layout, composition weights, action beats, continuity anchors, and reading order defined by this image. Render the final video in the style lock, not in line-art storyboard style.
```

**主体 ref + 首帧**（f2v 镜头 / 精确衔接前镜）：

```text
@image1 — [subject tag] subject reference — identity and appearance are defined by this image, do not substitute
@image2 — first frame — the video must start from this exact frame
```

**只有主体 ref**（i2v 单主体镜头）：

```text
@image1 — [subject tag] subject reference — identity and appearance are defined by this image, do not substitute
```

其他组合（主体 + motion ref、首尾帧、设定图 + 分镜图等）按同一原则拼：每张图一行、只承担一个维度、同维度只由一张图承载。

### 节拍过渡（可选）

只在镜头有明确节拍类型需要引导时加；简单延续动作、纯气氛镜头不加。按节拍类型选词（以下是示例，不是穷举）：

| 节拍类型 | 词汇示例 |
|---------|---------|
| 静—动对比（爆发、撞击） | `held / one beat of stillness / sudden / compressed / as X peaks, Y begins` |
| 渐强累积（升压、聚拢） | `gradual / accumulating / building / measured` |
| 延展持续（奔跑、漂移） | `continuous / unbroken / deliberate / sustained` |

写法：`panel X → panel Y: [节奏词]`（写节奏不写画面）。

### 不能写

**按传入的资产条件生效**——资产已锁什么维度，prompt 文字就不要重复写那个维度。每种资产锁的维度见 [media-principles.md §1 资产本体](references/media-principles.md#1-资产本体)。

**普遍禁止**（与资产无关）：

- ❌ 时间戳 / timeline（描述式 prompt 让模型排时序更稳）
- ❌ 画质堆叠词（`4K, cinematic quality`）和防漂移兜底词（`stable face, same character, consistent outfit`）
- ❌ 逐节拍画面复述（即使没分镜图，描述式写一段状态转变即可，不要逐秒展开）

**诊断判据**：某句话删掉后模型只能靠资产理解它 → 该删。能删的都删。

---

## Prompt Repair

先诊断失败类型再改，不盲修。同时不改主体、风格、镜头、时长四件事——过载时直接重写。

| 失败类型 | 修法 |
|---------|------|
| 主体不对 / 主体消失 / 主体融合 | 按顺序排查：① **映射错位**（最常见，见「身份核对」）；② ref 信息不足（只有正面照但镜头要侧背 → 补设定图或换角度 ref）；③ 多张同主体 ref 互相稀释（见 media-principles.md §1 多资产叠加）；④ ref 风格与目标风格冲突（见 §1 ⚠️ 边界情况）。前三步都排除后再补识别特征 |
| 构图乱 | 补景别/视角 |
| 风格偏移 | 收敛主风格锚点 |
| 视频不稳 | 降运动复杂度 |
| i2v 失真 | 删静态描述只保动作运镜 |
| 视频空洞 | 补 A→B 状态转变事件 |
| 物理不可信 | 补材质属性和力的方向 |
| 动作乱序 | 描述式重写；反复出错说明场景超出模型能力，拆镜头 / 降复杂度 / 改 f2v 首尾帧锚定，不要上硬编码时间戳 |
| 手部/表情失真 | 起止轨迹描述 |

---

## 何时读 references

| 场景 | 读哪个 |
|------|--------|
| 写 image prompt | [image-guide.md](references/image-guide.md) |
| 写 video prompt、分镜、运镜 | [video-guide.md](references/video-guide.md) |
| 选模式、参考图策略、一致性诊断、设定图 / 分镜图规格、pre-production 流水线 | [media-principles.md](references/media-principles.md) |
| 写 `step_sb_N` 的分镜图提示词 | [storyboard-template.md](references/storyboard-template.md) |
| Plan 文件格式 | [plan-schema.md](references/plan-schema.md) |

简单单图、用户已给完整 prompt 只需微调时不读。
