# Image Prompt 规则与速查

## 先抽 6 个变量

1. 主体：谁 / 什么，最关键的识别特征
2. 环境：发生在什么空间
3. 构图：景别、视角、主体位置
4. 风格：1 个主风格锚点，最多 1 个辅助
5. 光照：时间、方向、质感
6. 输出约束：画幅、镜头、材质、用途

## 叙事张力检查

好图片捕捉**正在发生的瞬间**，不是静态摆拍：

- **决定性瞬间**：主体处于 mid-action 状态？
- **力的方向**：画面中有可感知的力（风、重力、运动惯性、视线方向）在驱动变化？
- **临界状态**：暗示"下一秒会发生什么"？

❌ `A beautiful woman standing in a garden`
✅ `A woman mid-stride through a rain-soaked garden, one hand reaching to catch a falling camellia petal, dress hem swirling from the turn`

不是每张图都需要剧烈动作，但需要一个"正在发生"的瞬间感——哪怕是蒸汽升起、光线移动、水面波动。

## Prompt 骨架

```text
[subject + defining attributes], [environment + composition], [style anchor], [lighting], [camera/render tags], [stability constraints]
```

## 硬规则

- 主体明确时不叠第二套风格体系
- 构图不稳时先补景别/视角/位置，不堆风格词
- 追求 realism 时优先写镜头、材质、光照、景深
- 要精确布局或角色一致性时优先建议 reference
- Negative Prompt 只写真实失败模式，不写反义词
- 多主体时每个主体写明空间位置和景深关系

## 输出要求

- `Prompt` 一条紧凑长句，逗号分隔
- 默认英文；用户明确要中文则统一中文
- `Negative Prompt` 控制在 5-15 个词条

## 质量检查

- [ ] 明确视觉焦点
- [ ] 说明了景别/视角/位置中至少一项
- [ ] 只有 1 主风格 + 最多 1 辅助
- [ ] 删掉了不改变画面的词
- [ ] 多人精确互动写明空间关系？长文本（>3词）标明字体和位置？
- [ ] **叙事张力**：mid-action / 临界状态？纯静态摆拍不合格
- [ ] **注意力预算**：主焦点占 prompt 前 1/3 且描述量 ≥50%？

---

## 场景速查

| 场景 | 避坑 | Negative | 推荐参数 |
|------|------|----------|----------|
| 人像 | 1-2 人；手部简单动作 | `extra fingers, fused fingers, deformed hands` | 85mm f/1.4 / 2:3 |
| 产品摄影 | 写材质光学特性；避免多产品 | `busy background, multiple products, scratches, watermark` | 100mm macro / f/8-11 / 1:1 或 4:5 |
| 风景 | 具体地貌 + 光照时刻；前中后景分层 | `overexposed sky, flat lighting, people, powerlines` | 16-35mm / f/11 / 16:9 |
| 美食 | 蒸汽写 `wispy steam rising`；45° 或俯拍 | `unappetizing, cold, dark, blurry texture` | 50mm / 90mm macro / f/2.8-4 / 4:5 |
| 建筑 | 明确建筑风格名；对称最安全 | `people blocking view, lens distortion, overcast flat` | 24mm tilt-shift / f/8 / 16:9 |
| 概念艺术 | 写设计意图非堆细节；加 scale ref | `multiple characters, real photo, photorealistic skin` | wide angle / 16:9 |
| 时尚 | 写材质剪裁；背景干净 | `deformed limbs, extra fingers, busy background, logo visible` | 85mm / f/2-4 / 2:3 |
| 静物 | 主体 3-5 个；单一光源 | `cluttered, harsh shadows, flat lighting, cropped objects` | 90mm / f/5.6 / 1:1 或 4:5 |
| 微距 | 明确焦点 `sharp focus on the stamen` | `out of focus subject, busy background, motion blur` | 100mm macro / f/2.8 / 1:1 |
| 航拍 | 明确俯拍角度；不同时要求人脸细节 | `low altitude, haze, overexposed, noise` | 24mm / f/5.6 / 16:9 |
| 街拍 | — | — | 35mm / 50mm / f/2 / high ISO grain / 3:2 |
| 动物 | 写动作瞬间和眼神质量 | `blurry eyes, motion blur on face, unnatural pose` | 400mm telephoto / f/5.6 / 3:2 |
| UI 素材 | 正交/等距视角；指定背景 | `shadow, perspective distortion, realistic photo, text` | 正交/等距 / 透明背景 / 1:1 |
| 抽象 | 写视觉动势和色彩关系 | `recognizable objects, faces, text, rigid geometric` | 1:1 或宽幅 |

## 风格速查

### 摄影

| 风格 | 关键词 |
|------|--------|
| 纪实 | documentary, candid, decisive moment, grain |
| 肖像 | editorial portrait, studio lighting, dramatic |
| 电影感 | cinematic, anamorphic, film still, color grading |
| 胶片 | shot on Kodak Portra 400 / Fujifilm Pro 400H / Kodachrome / Ilford HP5 |
| 极简 | minimalist, negative space, clean |
| 暗调 | dark moody, chiaroscuro, low-key |
| 明亮 | light and airy, soft pastel, high-key |
| 长曝光 | long exposure, light trails, silky water |

### 绘画与插画

| 风格 | 关键词 |
|------|--------|
| 油画 | oil painting, impasto, visible brushstrokes |
| 水彩 | watercolor, wet-on-wet, soft edges |
| 数字绘画 | digital painting, artstation, semi-realistic |
| 扁平插画 | flat illustration, vector art, geometric, bold colors |
| 线描 | line art, ink drawing, cross-hatching |
| 动漫 | anime style, cel shading, manga |
| 像素 | pixel art, 8-bit, 16-bit, retro game |

### 3D 渲染

| 风格 | 关键词 |
|------|--------|
| 写实 3D | photorealistic 3D, Unreal Engine, ray tracing, PBR |
| 卡通 3D | Pixar style, clay render, stylized |
| 等距 | isometric 3D, low poly, diorama |
| 玻璃拟态 | glassmorphism, frosted glass, translucent |

### 时代与运动

| 风格 | 关键词 |
|------|--------|
| 文艺复兴 | Renaissance, chiaroscuro, sfumato |
| 巴洛克 | Baroque, dramatic, ornate, Caravaggio |
| 印象派 | Impressionist, Monet, dappled light |
| 新艺术 | Art Nouveau, organic curves, Mucha |
| 装饰艺术 | Art Deco, geometric, gold, 1920s |
| 波普 | Pop Art, Warhol, halftone |
| 赛博朋克 | Cyberpunk, neon, dystopian |
| 蒸汽朋克 | Steampunk, brass, clockwork |
| 合成波 | Synthwave, retrowave, 80s, sunset gradient |

### 电影参考

| 参考 | 视觉特征 |
|------|---------|
| Wes Anderson | 对称、粉彩、精心布景 |
| Blade Runner | 霓虹雨夜、蓝橙、体积雾 |
| Studio Ghibli | 水彩、田园、温暖光线 |
| Roger Deakins | 自然光、深度构图、极简色彩 |
| Wong Kar-wai | 饱和色彩、暧昧光影 |

风格混合：先定主导风格再加辅助，最多 2 种。写法：`X style with Y elements`

## 构图

| 构图 | 关键词 | 适用 |
|------|--------|------|
| 三分法 | rule of thirds | 通用 |
| 中心对称 | centered, symmetrical | 建筑、产品 |
| 对角线 | diagonal composition | 动态、冲突 |
| 框中框 | frame within frame | 门窗、拱门 |
| 引导线 | leading lines | 道路、走廊 |
| 负空间 | negative space | 极简、海报 |
| 前中后景 | foreground/midground/background | 风景、电影感 |

## 布光

| 布光 | 关键词 | 效果 |
|------|--------|------|
| 伦勃朗 | Rembrandt lighting | 面部三角光斑、戏剧性 |
| 蝶形光 | butterfly lighting | 突出颧骨、美妆 |
| 分裂光 | split lighting | 半明半暗、神秘 |
| 轮廓光 | rim light, edge light | 分离主体、发丝光 |
| 逆光 | backlight, contre-jour | 剪影、光晕 |
| 黄金时刻 | golden hour | 暖调、长影 |
| 蓝调时刻 | blue hour | 冷调、宁静 |
| 阴天 | overcast, diffused | 均匀、无硬影 |
| 窗光 | window light | 自然、侧向 |
| 特殊光效 | volumetric light / god rays / caustics / lens flare / bloom / bokeh | — |

## 高级技巧

**JSON 结构化（多主体精确排列）**：2+ 主体需精确空间定位时可用，单主体/氛围类用自然语言更好。

**文字渲染**：双引号包裹，1-3 个英文单词最可靠，指定字体风格和位置。

**颜色精确控制**：HEX + 具体色名 > 泛称（crimson > red）。

**空间控制**：每主体指定屏幕位置 + 景深，最多同时精确控制 2-3 个主体。

## 常见翻车与修正

| 问题 | 策略 |
|------|------|
| 手指错误/融合 | 简单动作（托腮、握物），negative 加 `extra fingers, fused fingers` |
| 多人面部互换 | ≤ 2-3 人，服装颜色区分，景深分离 |
| 文字拼写错误 | 简短大写英文，指定字体，预留干净区域 |
| 对称性不准 | 写 `perfectly symmetrical`，正面视角 |
| 比例失调 | 提供参考物 |
| 风格四不像 | 明确主导风格，最多 2 种 |

## 迭代诊断顺序

1. 主体问题 → 补材质/动作细节或简化主体数量
2. 氛围问题 → 调光照和风格层
3. 构图问题 → 明确景别和视角
4. 风格偏移 → 检查是否超 2 种风格，移除冲突词

## 示例

### 产品摄影 — 手表

**Prompt**: luxury mechanical wristwatch with exposed movement visible through sapphire caseback, brushed stainless steel case with polished chamfered edges, deep midnight blue sunburst dial, applied rhodium-plated hour markers, alligator leather strap in dark brown, watch resting at slight angle on polished black obsidian surface, soft studio lighting from upper left creating gentle highlights on case curves, subtle reflection on surface beneath, clean dark gradient background fading to black, commercial product photography, 100mm macro lens, f/8

**Negative**: blurry, busy background, watermark, text, multiple watches, scratches

### 电影感人像 — 雨夜街头

**Prompt**: cinematic photography, young woman walking alone on rain-soaked Shinjuku street at night, shot from behind at three-quarter angle, black leather jacket glistening with rain, short dark hair plastered to neck, transparent umbrella tilted slightly forward, neon signs reflected in wet asphalt as streaks of pink and cyan, steam rising from a ramen shop on the left, shallow depth of field blurring distant pedestrians into bokeh, anamorphic lens with horizontal flare, teal and orange color grading, 35mm, f/1.8, cinematic film grain

**Negative**: low quality, deformed, cartoon, anime, bright daylight, watermark, extra limbs

### 概念艺术 — 废土旅行者（中文）

**Prompt**: 概念艺术，孤独的旅行者站在坍塌的混凝土桥桥头，身着破损的军绿色风衣，背部朝向镜头，沙漠荒原延伸至地平线，地平线处有锈蚀的巨型钢架残骸，低垂的橙红色落日将天空染成 #E8602C 橙与灰紫色渐变，地面散落碎石与枯骨，前景有飞扬的沙尘，wide angle，戏剧性逆光，体积光穿过废墟缝隙，末世电影美学

**Negative**: 低质量，模糊，卡通，现代建筑，人群，绿色植被
