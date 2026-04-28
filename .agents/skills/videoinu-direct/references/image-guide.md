# Image Prompt 速查

面向 gpt-image-2。模型擅长 instruction-following，**优先写自然语言的完整描述**，而不是标签堆砌。下方词表用作词汇参考，不是骨架填空项。

**带参考图时**（r2i / 多图场景）先读 SKILL.md「身份核对」「多图必写用途说明」「有资产时的正片 prompt」反稀释原则。

**作为设定图 / 分镜图生成**（pre-production 用途）时不走本文件的一般性规则，见 [media-principles.md §4](media-principles.md#4-pre-production-流水线设定图--分镜图--正片) / [§5](media-principles.md#5-分镜图规格) 的专用规格。

gpt-image-2 **没有 negative prompt 参数**，不要单独写"Negative:"字段；要排除的内容直接在正向 prompt 中说（例："no text, no watermark"）。

## Prompt 结构

写成一段自然语言，按下列顺序展开即可，不需要逗号分隔的 tag 流：

1. **主体**：是什么、关键属性、动作/姿态
2. **场景**：环境、时间、氛围
3. **构图**：景别、视角、主体在画面中的位置、前中后景关系
4. **光照**：方向、时间、质感
5. **风格**：1 个主风格锚点，必要时加 ≤1 个辅风格
6. **输出约束**：画幅、镜头参数、材质、分辨率相关提示

复杂主体（角色设定、产品规格、品牌视觉）建议用**结构化规格写法**——分小标题列出外观/材质/配色/比例等，模型会严格按规格生成。

## 核心规则

- 主体明确时不叠第二套风格；构图不稳先补景别/视角而非堆风格词
- 追求 realism 写镜头、材质、光照、景深；精确布局或身份一致性优先走 edit + reference
- 多主体写明空间位置和景深关系
- 要排除的元素写在正向 prompt 里，不要用反义词堆砌
- 镜头/胶卷型号（`f/1.8`、`Kodak Portra 400`）对 gpt-image-2 是风格暗示，不是物理参数
- 默认英文 prompt；中文可用，但专业术语保留英文命中率更高

## Edit 场景

使用 `images.edit` 带 reference 图时：

- **描述整张最终图像**，不要只描述要改的局部——保留不变的部分也写一遍以防漂移
- 多图输入时先写身份/物体一致性约束（"keep the same character's face, clothing, and pose from reference"），再写要改变的部分

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

### 自然语言段落（推荐默认形态）

A cinematic photograph of a young woman walking alone on a rain-soaked Shinjuku street at night. Shot from behind at a three-quarter angle, she wears a black leather jacket glistening with rain and holds a transparent umbrella tilted slightly forward; her short dark hair is plastered to her neck. Neon signs reflect on the wet asphalt as streaks of pink and cyan, and steam rises from a ramen shop on the left side of the frame. Distant pedestrians are blurred into bokeh by a shallow depth of field. Style: anamorphic cinematic look with horizontal lens flare, teal-and-orange color grading, subtle film grain. No text, no watermark, no visible logos.

### 结构化规格（复杂主体/角色/产品时用）

```text
Render a product shot of the following item:

Item: ceramic pour-over coffee dripper
Shape: cone, 60° slope, single spiral rib on the inner wall
Material: matte unglazed stoneware, fine speckled texture
Color: warm off-white body, charcoal rim
Size cue: sits on a walnut wood board, human hand out of frame

Scene: soft morning light from a window on the left, thin steam rising from the dripper, shallow depth of field, background blurred to a neutral warm gray.
Composition: centered, eye-level, product fills the middle third of the frame.
No text, no watermark.
```
