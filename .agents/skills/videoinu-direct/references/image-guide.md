# Image Prompt 速查

**带参考图时**（r2i / 多图场景）先读 SKILL.md「身份核对」「`@imageN` 的正面用途说明」「有资产时的 prompt 反稀释原则」，本文件只覆盖纯文生图。

## Prompt 骨架

```text
[subject + defining attributes], [environment + composition], [style anchor], [lighting], [camera/render tags], [stability constraints]
```

6 个变量覆盖完：主体、环境、构图（景别+视角+位置）、风格（1 主 ≤1 辅）、光照（时间+方向+质感）、输出约束（画幅+镜头+材质）。

## 核心规则

- 主体明确时不叠第二套风格；构图不稳先补景别/视角而非堆风格词
- 追求 realism 写镜头、材质、光照、景深；精确布局或主体一致性优先 reference
- 多主体写明空间位置和景深关系
- Negative Prompt 只写真实失败模式（5-15 词），不写反义词
- 输出：Prompt 一条紧凑长句逗号分隔，默认英文

---

## 风格速查

### 摄影

| 风格 | 关键词 |
|------|--------|
| 纪实 | documentary, candid, decisive moment, grain |
| 肖像 | editorial portrait, studio lighting, dramatic |
| 电影感 | cinematic, anamorphic, film still, color grading |
| 胶片 | shot on Kodak Portra 400 / Fujifilm Pro 400H |
| 极简 | minimalist, negative space, clean |
| 暗调 | dark moody, chiaroscuro, low-key |
| 长曝光 | long exposure, light trails, silky water |

### 绘画与插画

| 风格 | 关键词 |
|------|--------|
| 油画 | oil painting, impasto, visible brushstrokes |
| 水彩 | watercolor, wet-on-wet, soft edges |
| 数字绘画 | digital painting, artstation, semi-realistic |
| 扁平插画 | flat illustration, vector art, geometric |
| 动漫 | anime style, cel shading, manga |

### 3D 渲染

| 风格 | 关键词 |
|------|--------|
| 写实 3D | photorealistic 3D, Unreal Engine, ray tracing |
| 卡通 3D | Pixar style, clay render, stylized |
| 等距 | isometric 3D, low poly, diorama |

需要引用特定导演/影片视觉时直接写名字（如 `Wes Anderson style`、`Blade Runner aesthetic`），模型可识别；但不要依赖它做风格主锚点，配合构图/色调/光照等具体描述使用。

## 构图

| 构图 | 关键词 |
|------|--------|
| 三分法 | rule of thirds |
| 中心对称 | centered, symmetrical |
| 对角线 | diagonal composition |
| 框中框 | frame within frame |
| 引导线 | leading lines |
| 负空间 | negative space |
| 前中后景 | foreground/midground/background |

## 布光

| 布光 | 关键词 |
|------|--------|
| 伦勃朗 | Rembrandt lighting |
| 蝶形光 | butterfly lighting |
| 分裂光 | split lighting |
| 轮廓光 | rim light, edge light |
| 逆光 | backlight, contre-jour |
| 黄金时刻 | golden hour |
| 蓝调时刻 | blue hour |
| 窗光 | window light |
| 特殊光效 | volumetric light / god rays / caustics / lens flare / bokeh |

## 示例

**Prompt**: cinematic photography, young woman walking alone on rain-soaked Shinjuku street at night, shot from behind at three-quarter angle, black leather jacket glistening with rain, short dark hair plastered to neck, transparent umbrella tilted slightly forward, neon signs reflected in wet asphalt as streaks of pink and cyan, steam rising from a ramen shop on the left, shallow depth of field blurring distant pedestrians into bokeh, anamorphic lens with horizontal flare, teal and orange color grading, 35mm, f/1.8, cinematic film grain

**Negative**: low quality, deformed, cartoon, anime, bright daylight, watermark, extra limbs
