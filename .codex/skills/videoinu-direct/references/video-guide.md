# Video Prompt 规则与速查

## 模式区分

- `text-to-video`：补全主体、环境、动作、镜头
- `image-to-video`：静态内容以参考图为准，文本只负责动作、运镜、气氛变化

## 默认参数

| 参数 | 默认值 |
|------|--------|
| 时长 | 8-10s |
| 画幅 | 16:9 |
| 镜头数 | 单镜头或 3 镜头 |

## 事件密度

AI 视频没有真实微表情和配乐，画面里没有**可见状态转变**就是空洞。

- **每个镜头必须有至少一个状态转变**：从 A 到 B，观众能说出"发生了什么"
- **是状态转变**：reveal、交互、姿态变化、环境事件（火焰升起、鸟群惊飞）
- **不是状态转变**：披风飘动、头发吹动、缓慢推镜、呼吸白雾、rack focus
- 15s 至少 1 状态转变 + 1 环境变化；8-10s 至少 1 状态转变
- Establishing/空镜标注 `[type: establishing]` + 叙事功能，连续豁免不超过 1 个

## 先抓 6 个变量

1. 模式：t2v 还是 i2v
2. 主体锚点：跨镜头复用的 2-3 个稳定特征
3. **相机运动**：类型 + 速度 + 幅度/方向（见§相机运动）
4. 主运动：真正要看的动作
5. **状态转变**：A → B 发生了什么"事件"
6. 空间关系：前景/中景/背景/左/右/behind/OTS/POV

## 硬规则

- 先保**单主体 / 单主运动 / 单镜头目标**——但单主运动 ≠ 低表现力，一个主运动可包含丰富叙事（剑客拔刀的同时风卷落叶）
- **每镜头必须有状态转变**。Shot Plan 先填"发生了什么事"，答案是"人站着/镜头慢推"就不合格
- **相机运动是第一优先级可控维度**：每个 prompt 必须包含运镜指令（类型+速度+方向），不能省略
- **运镜表现力底线**：
  - 起止景别至少跨 2 级（如 wide → close-up）。单级变化（medium → medium close-up）只用于过渡镜头
  - 复合运镜（主+从）是叙事镜头的默认选项，不是"高级用法"。单一运镜类型只用于刻意的静制或对比效果
  - 整组镜头中至少 1 个使用 swift 以上速度
- **主体运动和相机运动可同时有力度**。同向组合最稳定，反向/交叉组合制造冲击感——动作高潮应该大胆用。复合运镜+多步动作时标明主从
- 每镜头只写镜头内发生的事
- 不用否定表达，只描述应该出现什么
- **尾部标签**：画质 `4K, ultra HD, rich detail, sharp focus, cinematic quality`（动漫用 `crisp linework, theatrical rendering`）| 角色稳定 `clear facial features, stable face, no distortion` | 多镜头追加 `same character, consistent outfit`（仅辅助，不替代视觉手段）
- i2v 不重复描述首帧静态内容，只写变化
- **动作速度服从叙事需要，不默认选"缓慢"**。选 slow 需要叙事理由（仪式感、悬念铺垫、余韵），高潮镜头默认 swift 以上
- 迭代只改一维（主体 / 构图 / 光照 / 风格 / 运动），同时改多维无法定位问题

## Packed Prompt 结构

权重从左到右递减，主体和动作永远放最前面：

```text
[mode/style], [subject anchors], [setting], [camera move: type + speed + direction], [state transition + action: A→B event], [lighting/atmosphere], [quality/stability constraints]
```

**符号系统**：`->` 因果触发 | `+` 同时发生 | `—` 分隔多主体

要点：
- camera move 前置到事件之前，写明类型+速度+方向三要素
- state transition + action 合并：先写"发生了什么"（A→B），再写"怎么发生的"
- **单条 prompt ≤ 1000 字符**

### 描述式 vs Timeline Prompting

**默认用描述式**——描述场景中会发生什么（what happens）、起始/结束状态、运镜方向，让模型自己编排时序和物理细节。

描述式示例：
```text
[mode/style], [subject anchors], [setting], [camera move],
warrior drives naginata into stone floor, golden cracks radiate outward,
golden energy rises into darkness above, white dragon crystallizes from particles coiling in mid-air,
dragon fully forms, red eyes ignite,
[lighting], [quality constraints]
```

**不要**：
- 用 `first... then... finally...` 编排时序
- 描述模型已经知道的物理细节（手指怎么握、鳞片怎么结晶）
- 把起止景别之间的运镜过程展开描述——写起止点即可

### Timeline Prompting（纠正手段，非默认）

仅当模型**反复在同一个时序问题上出错**时使用。同一时序错误出现 2 次 → 用 Timeline 纠正那个点。第一次 → 先用描述式重写。

```text
[mode/style], [subject], [setting], [camera move],
0-3s: [只写模型搞错的那个阶段的纠正指令]
3-6s: [后续正常描述]
[lighting], [quality constraints]
```

## 质量检查

每次必检：

- [ ] **事件检查**：能否用主谓宾描述"发生了什么"？
- [ ] 只有一个主运动
- [ ] 给了主体锚点
- [ ] **运镜三要素**：类型 + 速度 + 幅度/方向都写明了？复合运镜标明主从？
- [ ] **运镜意图**（叙事关键镜头）：reveal / emphasize / establish / follow / isolate？
- [ ] **运镜与主体运动协调**：方向关系明确？复合叠加标明主从？
- [ ] **运镜表现力**：景别跨越 ≥ 2 级？叙事镜头用了复合运镜？不是全组都 slow？
- [ ] **反保守检查**：连续 2+ 镜头用 slow/gentle 不合格 | 全组无 swift+ 运镜不合格 | 全组无复合运镜不合格
- [ ] **物理交互**：写了材质属性和力的方向？纯 `flowing gracefully` 不合格
- [ ] 用空间词非朝向玄学
- [ ] 补了角色稳定和画质约束

多镜头追加：

- [ ] **空间因果链**：相邻镜头尾→头观众能理解？断裂是刻意跳切还是无意遗漏？
- [ ] **光照连续性**：光源方向/色温连贯？变化和情绪曲线一致？
- [ ] **视觉重心**：主体屏幕位置没有在相邻镜头间无理由大跳？
- [ ] 镜头间递进关系（非并列堆砌）
- [ ] 景别有变化
- [ ] **运镜多样性**：相邻镜头运镜类型有变化？连续 2+ 镜同类运镜不合格
- [ ] **节奏对比**：速度曲线有梯度？不是全程一个速度？
- [ ] **时长分配**：高潮和钩子的时长和其他镜头不同？

## 相机运动

### 三要素：类型 + 速度 + 幅度/方向

❌ `dolly in`
✅ `slow dolly in, starting from full shot gradually tightening to medium close-up`

### 第四要素：运镜意图

叙事关键镜头加意图：**reveal**（终点暴露新信息）| **emphasize**（收束到叙事重心）| **establish**（扩展空间）| **follow**（跟踪主体）| **isolate**（从环境抽离主体）

✅ `slow dolly in from full shot to medium close-up, gradually revealing the scar across her left cheek`

### 速度修饰词

| 速度词 | 情绪效果 | 适用 |
|--------|---------|-----|
| imperceptible / barely moving | 催眠、仪式感 | 空镜、奢侈品（限定场景） |
| slow / gentle | 优雅、从容 | 铺垫、余韵（**需要叙事理由，不是默认选项**） |
| **steady / moderate** | 中性叙事 | **默认速度**，跟镜、产品展示、一般叙事 |
| swift / fast | 冲击、紧张、高潮能量 | 动作、悬疑、**高潮镜头的默认选项**、任何需要视觉冲击的场景 |
| aggressive / whip / snap | 极致冲击、暴力美学 | 战斗、爆发、MV 快切、转场强调 |
| accelerating / decelerating | 情绪转折 | 起承转、收尾、从静到动或反之 |

### 复合运镜

叠加两种运镜，**标明主从**：
✅ `swift crane up [主] with pan right [从]`
❌ `crane up + pan right + zoom in`（三重叠加失控）

### 运镜与景别联动

| 运镜 | 景别变化 | 写法示例 |
|------|---------|---------|
| dolly in | 远→近 | `dolly in from wide shot to close-up` |
| dolly out | 近→远 | `pull back from close-up to wide shot revealing full scene` |
| crane up | 仰→平/俯 | `crane up from low angle ground level to eye-level medium shot` |
| orbit | 同景别换角度 | `90-degree orbit around subject, maintaining medium shot` |

### 运镜与主体运动协调

| 组合模式 | 写法要点 |
|---------|---------|
| 相机动 + 主体静 | 主体用 `still, stationary` 锁定 |
| 相机跟 + 主体行走 | 速度匹配 `camera follows at walking pace` |
| 相机动 + 主体剧烈运动 | 写明运动方向关系（同向/交叉），标明主从 |
| 反向运动（相机与主体对冲） | 冲击感手法，写明各自方向 |
| 定镜 + 主体运动 | 写 `locked camera / static shot` |

**表现力优先于稳定性**。"相机动 + 主体剧烈运动"是动作高潮的标配。

---

## 多镜头分镜

≥2 镜头时必读。

### 空间因果链

相邻镜头之间**默认需要可见的视觉桥梁**。但**刻意跳切是合法叙事手段**。

跳切合法的条件（满足任一即可豁免）：

| 条件 | 示例 |
|------|------|
| **时间省略** | 白天训练 → 夜晚对决 |
| **平行叙事** | 战士蓄力 ↔ 敌人逼近 |
| **情绪冲击** | 宁静花田 → 战场废墟 |
| **节奏驱动** | MV 节拍硬切 |

跳切是 bug 的信号：空间困惑（"她怎么到那里的？"）| 元素断链（视觉线索凭空消失又出现新的）| 无意断裂。

**非跳切场景的核心规则**：

1. **空间跳跃必须交代**：过渡镜头开头包含空间转换的视觉线索
2. **视觉元素要传递**：前镜结尾的关键元素，后镜开头要承接或演变
3. **情绪落差要缓冲**：极高能量直接切到静止，中间加能量衰减过渡

### 光照连续性

1. **光源方向默认一致**：每镜头都要写光照指令，不写模型会随机
2. **叙事性变化要显式**：光照变化本身可以是事件，写明变化过程
3. **光照变化是情绪信号**：暖→冷 = 转折/威胁，冷→暖 = 希望/解脱

### 视觉重心

1. 主体屏幕位置不要在相邻镜头间大跳，用空间词给提示
2. 景别跳跃时标注主体在远景中的大致位置
3. 运镜终点 = 下一镜头起点的视觉重心

### 时长分配

| 镜头功能 | 建议时长 | 理由 |
|---------|---------|------|
| 钩子/开场 | 3-5s | 快速抓注意力 |
| 建立/铺垫 | 8-10s | 交代空间氛围 |
| 推进/动作 | 8-10s | 完成状态转变 |
| **高潮/爆发** | **10-12s** | **最高信息密度 = 最多时间** |
| 收束/余韵 | 8-10s | 回味空间 |

全部镜头均分时长 = 没做过分配决策。

### 节奏模板

| 模板 | 情感曲线 | 适用 |
|-----|---------|-----|
| 起承转收（3-4 镜） | 平→升→峰→收 | 广告、概念片 |
| 钩子-揭示（2 镜） | 悬念→释放 | 悬念短片、产品揭幕 |
| 氛围单镜 | 平铺或缓升 | 风景、情绪片 |
| 对比并置（2 镜） | 对立张力 | 前后对比 |
| 节拍循环（多镜） | 跟节拍起伏 | MV、Vlog |

### 分镜自检

1. 三镜头讲清"是什么 → 发生了什么 → 收尾"？
2. 每镜头能用主谓宾描述事件？
3. 运镜三要素写全、相邻有变化、整组有弧线？
4. 空间因果链连贯？
5. 光照/色温曲线连贯？
6. 视觉重心无无理由大跳？
7. 时长分配区分了高潮/钩子？
8. 有没有两镜头主矛盾重复？

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

| 景别 | 关键词 | 作用 |
|------|--------|------|
| 大远景 | extreme wide shot | 环境规模 |
| 远景 | wide shot | 空间关系 |
| 全景 | full shot | 全身+环境 |
| 中景 | medium shot | 腰部以上，叙事主力 |
| 近景 | medium close-up | 胸部以上，情绪 |
| 特写 | close-up | 面部/细节 |
| 大特写 | extreme close-up | 局部 |

### 光影氛围词

| 氛围 | 关键词 |
|------|--------|
| 温暖 | warm golden hour, 柔光 |
| 冷冽 | 蓝调时刻, 硬光 |
| 电影感 | teal and orange, 体积光, cinematic |
| 梦幻 | 柔焦光晕, 粒子漂浮, bokeh |
| 戏剧 | 强对比, 伦勃朗光, split lighting |
| 阴郁 | 低饱和, 雾气, 阴天散射光 |
| 霓虹 | 冷暖对比, 湿反射, neon glow |

### 物理交互描述

写**材质属性 + 力的方向 + 过程**，不写效果形容词：

| 维度 | ❌ 效果词 | ✅ 物理描述 |
|------|---------|-----------|
| 布料 | `silk flowing gracefully` | `lightweight silk, catching wind from left, fabric rippling with visible weave texture` |
| 碰撞 | `ball bouncing` | `ball strikes wall at angle, compresses on impact, rebounds at lower angle` |
| 火焰 | `fire burning` | `flames rising from base, flickering irregularly, amber core fading to translucent orange edges` |

**材质属性速查**：重量(`lightweight/heavy`) | 柔软度(`rigid/flexible/elastic`) | 透光性(`opaque/translucent`) | 表面(`matte/glossy/rough`)

### 人体动作：起止轨迹

精细动作用**起点→终点→过程变化**，常规动作（走路、转头）用动词即可：

- 手部：❌ `waving hand` → ✅ `right hand rises from waist to chest height, fingers spreading during ascent`
- 全身：❌ `sitting down` → ✅ `knees bend, body lowers, hands reach for armrests, weight settling`

### 多主体空间表达

✅ 用构图方位 + 景深：`画面左侧前景 白衣女孩低头阅读 — 画面右侧中景 男孩站在窗边背对镜头`
❌ 避免朝向指令（`面对/背对` 模型极易出错）

---

## 完整示例

示例是最终 prompt——单镜头输出的 `Prompt:` 内容，或多镜头 `.prompts.json` 中 `input_spec.prompt` 的值。Style Lock、时长分配等决策记录属于 Plan `.md`，不进 prompt。

### 单镜头 — 动作（10s）

```
cinematic realistic, scarred ronin in tattered grey kimono, rain-soaked bamboo grove at dusk, swift crane up [主] with slight track right [从] from low-angle ground level to eye-level wide shot, ronin draws katana in single upward arc -> bamboo stalks split and topple outward in cascade, rain droplets scatter off blade edge, cold blue-grey dusk light with warm steel glint on blade, 4K, ultra HD, rich detail, sharp focus, cinematic quality, clear facial features, stable face
```

### 多镜头 — 追车（3 镜头）

Plan `.md` 记录：Style Lock（cinematic / teal and orange / hard light）、时长分配（3s / 5s / 4s）。以下是 `.prompts.json` 中各 step 的 prompt。

`shot_01`:
```
cinematic realistic high-contrast teal and orange, black muscle car rain-soaked narrow alley at night, aggressive whip pan left [主] with slight crane down [从] following the car from full shot, tires lose traction rear swings out -> car rips through rain curtain bursting from alley mouth, water fans off both walls, neon wet reflections hard light, 4K, ultra HD, cinematic quality
```

`shot_02`:
```
cinematic realistic high-contrast teal and orange, driver gripping steering wheel leather interior, swift dolly in [主] from medium shot to extreme close-up on driver's face with handheld shake [从], oncoming truck headlights flood windshield -> driver yanks wheel hard right body tilts with inertia, split lighting from oncoming headlights shifting teal to orange, 4K, cinematic quality, clear facial features, stable face
```

`shot_03`:
```
cinematic realistic high-contrast teal and orange, intersection rain night, fast crane up [主] with pan left [从] from ground-level full shot to bird's-eye extreme wide revealing full intersection, two vehicles scrape past each other -> metal sparks jet along contact surface, muscle car punches through intersection taillights dissolving into rain fog, volumetric light through rain mist, 4K, ultra HD, cinematic quality
```

## Prompt Repair 速查

| 失败类型 | 修法 |
|---------|------|
| 主体不对 | 补识别特征 |
| 构图乱 | 补景别/视角 |
| 风格偏移 | 收敛主风格锚点 |
| 视频不稳 | 降运动复杂度 |
| i2v 失真 | 删静态描述只保动作运镜 |
| 视频空洞 | 补 A→B 状态转变事件 |
| 图片呆板 | 换 mid-action 姿态 |
| 物理不可信 | 补材质属性和力的方向 |
| 动作乱序 | 先用描述式重写；同一错误 2 次后用 Timeline 纠正 |
| 手部/表情失真 | 起止轨迹描述 |
| **运镜保守** | **景别跨度不够→加大；速度太慢→提到 swift+；缺复合→加从运镜；缺冲击手法→用 whip/crash/snap** |

## 迭代诊断顺序

1. 角色漂移 → 强化锚点描述
2. 动作不稳 → 先检查运镜与主体运动是否冲突，再考虑降速或拆镜头
3. 空间错乱 → 改为画面方位+景深
4. 风格偏移 → 每镜头末尾都带风格锚点词
5. 主体融合 → 减少同框数量或加景深分离
6. 物理不可信 → 补材质属性+力的方向+过程
7. 动作乱序 → 先描述式重写；同一错误 2 次后 Timeline 纠正
8. 精细动作失真 → 起止轨迹描述
