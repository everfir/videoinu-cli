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
来源类型：`ref image` | `first-frame chain` | `LoRA` | `anchor text` | `motion ref` | `seed` | `style_lock`
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

**只放执行必须的数据**。创作侧元数据（事件描述、注意力预算、可生成性评分、style lock）留在 Plan `.md` 或作为写 prompt 的思考过程，不进 JSON。

```json
{
  "steps": {
    "step_1": {
      "type": "image",
      "input_spec": {
        "prompt": "最终 prompt",
        "<slot>": "<值或占位符>"
      }
    },
    "shot_01": {
      "type": "image-to-video",
      "input_spec": {
        "prompt": "...",
        "image": "{type:\"core_node\", core_node_id:\"REF_IMG\"}"
      }
    }
  }
}
```

执行后追加 `result`：
```json
{ "result": { "core_node_id": "...", "instance_id": "..." } }
```

### 字段读写

| 字段 | 行为 |
|------|------|
| `steps[key].type` | 读：决定工作流类型 |
| `steps[key].input_spec` | 读：`videoinu run --input-spec` 的输入 |
| `steps[key].result` | 写：执行成功后追加 |

## 占位符规则

- `.md`「执行步骤」用全大写命名产物：`REF_IMG`、`SHOT_01`
- JSON 中引用：`"image": "{type:\"core_node\", core_node_id:\"REF_IMG\"}"`
- 执行前扫描 `input_spec` 中占位符，用已完成步骤的 `result.core_node_id` 替换；找不到停下报错
- 执行后回填 `result` 到 JSON，追加日志到 `.md`

## 中断恢复

找最新 `状态: executing` 的 Plan → 跳过已有 `result` 的步骤 → 从第一个缺 `result` 的继续。前序 `result` 异常时停下询问。

## 硬约束

- 没读 Plan 两个文件不执行
- 状态不是 `approved` 或 `executing` 不执行
- 占位符无对应 result → 停下报错
- 执行中不改 prompt / input_spec；要改先停下改 Plan 再让用户确认
