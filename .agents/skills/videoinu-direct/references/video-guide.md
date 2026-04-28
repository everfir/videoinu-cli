# Video Prompt 速查

## 模式

- `text-to-video`：补全主体、环境、动作、镜头
- `image-to-video`：静态内容以参考图为准，文本只写动作、运镜、气氛变化

默认时长 8-10s，画幅 16:9。

## Packed Prompt 结构

权重左到右递减，单条 ≤ 1000 字符：

```text
[mode/style], [subject anchors], [setting], [camera move: type + speed + direction], [state transition + action], [lighting/atmosphere], [quality constraints]
```

符号：`->` 因果触发 | `+` 同时发生 | `—` 分隔多主体

## 核心规则

- 单主体 / 单主运动 / 单镜头目标，每镜头要有状态转变（A → B 发生了什么）
- 必含运镜三要素：类型 + 速度 + 方向（❌ `dolly in` → ✅ `slow dolly in, from full shot to medium close-up`）
- 默认描述式 prompt，模型自己排时序。时序反复错说明场景超出模型能力，换策略（拆镜头 / 降复杂度 / f2v 首尾帧），不要靠硬编码时间戳强推
- i2v 不重复首帧静态内容，只写变化
- 不用否定表达；每个词都要对应画面中可见的东西或运镜，不造术语
- **有主体参考图 / 分镜图时禁用画质堆叠尾部标签和防漂移兜底词**（详见 SKILL.md「有资产时的正片 prompt」）；仅裸 t2v 可加尾部画质标签
- 迭代只改一维

## 使用分镜图参考时

基础骨架（style lock + `@imageN` 用途说明 + motion texture）见 SKILL.md「有资产时的正片 prompt」。本段只补分镜图场景下视频 prompt 的专门技巧。

**`camera rhythm` 不按 panel 数逐格列**。只挑会改变观众感受的力学节点：进入压力 / 失控点 / 主转折点 / 回正 / 释放。每个节点写相机如何服务这个力，而不是写"Panel 1, Panel 2..."。3-5 个节点，每个含 shot scale + move type + speed/direction。

反模式：
- ❌ 把 storyboard prompt 原文粘到 video prompt，模型会把正片当动作清单平均执行
- ❌ 只写"follow the storyboard"，模型不知道要补哪种镜头节奏
- ❌ 只写"do not show storyboard page"这类否定句，却不写最终画面形态
- ✅ 写"render as final full-frame video"，再说明 storyboard 只承担 action/composition/continuity

## 相机运动

### 速度修饰词

由慢到快：`imperceptible / barely moving → slow / gentle → steady / moderate → swift / fast → aggressive / whip / snap`；变速用 `accelerating / decelerating`。

### 复合运镜

叠加两种运镜，标明主从：
✅ `swift crane up [主] with pan right [从]`
❌ 三重叠加

### 运镜与主体运动协调

相机动而主体保持不动时显式写 `still, stationary`，否则主体可能被带动。跟随镜头用 `camera follows at walking pace` 之类标明相机速度。

---

## 多镜头分镜

- 相邻镜头默认要有视觉桥梁（空间/光照/元素传递），刻意跳切除外
- 每镜头显式写光照指令，跨镜头的光照变化也要显式
- 叙事/动作多镜头跑分镜图（规格见 media-principles.md §5；触发条件见 SKILL.md「Pre-production 两层资产」）

---

## 速查资料

### 镜头运动词汇

| 类别 | 关键词 |
|------|--------|
| 推拉 | dolly in / dolly out |
| 横移 | truck / track |
| 升降 | crane up / crane down |
| 旋转 | orbit / arc shot |
| 跟随 | follow |
| 固定 | locked shot |
| 手持 | handheld / shaky |
| 变焦 | zoom in / zoom out |
| 冲击 | whip pan / snap zoom / crash dolly |
| 特殊 | dolly zoom / time-lapse / slow motion |

### 景别

| 景别 | 关键词 |
|------|--------|
| 大远景 | extreme wide shot |
| 远景 | wide shot |
| 全景 | full shot |
| 中景 | medium shot |
| 近景 | medium close-up |
| 特写 | close-up |
| 大特写 | extreme close-up |

光照词汇见 [image-guide.md](image-guide.md) 的「布光」段。

### 物理交互

写**材质属性 + 力的方向 + 过程**，不写效果形容词。示例：
❌ `ball bouncing` → ✅ `ball strikes wall at angle, compresses on impact, rebounds lower`

### 人体动作

精细动作用起点→终点→过程，常规动作用动词即可：
❌ `waving hand` → ✅ `right hand rises from waist to chest height, fingers spreading`

### 多主体空间表达

用**构图方位 + 景深**，不用朝向指令（`面对/背对` 模型极易出错）。示例：`画面左侧前景 主体 A —— 画面右侧中景 主体 B`

---

## 完整示例

```
cinematic realistic, scarred ronin in tattered grey kimono, rain-soaked bamboo grove at dusk, swift crane up [主] with slight track right [从] from low-angle ground level to eye-level wide shot, ronin draws katana in single upward arc -> bamboo stalks split and topple outward in cascade, rain droplets scatter off blade edge, cold blue-grey dusk light with warm steel glint on blade
```

Prompt Repair 见 SKILL.md「Prompt Repair」段。
