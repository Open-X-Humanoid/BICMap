# 机器人状态机转移表

## 状态枚举

| 状态值 | 枚举键 | 说明 |
|--------|--------|------|
| `idle` | `IDLE` | 空闲 |
| `moving` | `MOVING` | 移动中 |
| `rotating` | `ROTATING` | 原地旋转 |
| `arrived` | `ARRIVED` | 到达目标点 |
| `dwelling` | `DWELLING` | 停留中（如执行任务） |
| `waiting` | `WAITING` | 等待中（如等待门、电梯等外部条件） |
| `charging` | `CHARGING` | 充电中 |
| `docking` | `DOCKING` | 归位/回桩中 |
| `error` | `ERROR` | 异常 |
| `recovering` | `RECOVERING` | 恢复中 |
| `returning` | `RETURNING` | 返航中 |
| `manual` | `MANUAL` | 人工干预 |
| `paused` | `PAUSED` | 暂停 |

---

## 完整状态转移表

### 各状态允许转移到的目标状态

| 当前状态 | 可转移到的目标状态 |
|----------|-------------------|
| `idle` | `moving`, `charging`, `docking`, `error` |
| `moving` | `arrived`, `error`, `returning`, `paused`, `rotating` |
| `rotating` | `moving`, `error` |
| `arrived` | `moving`, `dwelling`, `waiting`, `charging`, `error`, `paused` |
| `dwelling` | `moving`, `error`, `paused` |
| `waiting` | `moving`, `error`, `paused` |
| `charging` | `idle`, `error`, `paused` |
| `docking` | `idle`, `error`, `paused`, `charging` |
| `error` | `recovering`, `idle`, `manual` |
| `recovering` | `moving`, `error`, `idle` |
| `returning` | `docking`, `charging`, `error`, `paused` |
| `manual` | `idle`, `moving`, `error`, `recovering` |
| `paused` | `moving`, `dwelling`, `waiting`, `idle` |

---

## 按来源状态展开的详细转移

### `IDLE` — 空闲

```
idle ──→ moving     (开始移动)
     ──→ charging   (前往充电)
     ──→ docking    (归位)
     ──→ error      (异常)
```

### `MOVING` — 移动中

```
moving ──→ arrived    (到达目标点)
       ──→ error      (移动异常)
       ──→ returning  (低电量返航)
       ──→ paused     (暂停)
       ──→ rotating   (转向/原地旋转)
```

### `ROTATING` — 原地旋转

```
rotating ──→ moving   (旋转完成，继续移动)
         ──→ error    (旋转异常)
```

### `ARRIVED` — 到达目标点

```
arrived ──→ moving    (前往下一个航点)
        ──→ dwelling  (停留执行任务)
        ──→ waiting   (等待外部条件)
        ──→ charging  (在充电站充电)
        ──→ error     (异常)
        ──→ paused    (暂停)
```

### `DWELLING` — 停留中

```
dwelling ──→ moving   (停留完成，继续移动)
         ──→ error    (异常)
         ──→ paused   (暂停)
```

### `WAITING` — 等待中

```
waiting ──→ moving    (条件满足，继续移动)
        ──→ error     (超时或异常)
        ──→ paused    (暂停)
```

> 等待条件由 `WaitCondition` 系统提供：
> - `WaitCondition.duration(ms)` — 等待固定时长
> - `WaitCondition.signal(name)` — 等待外部信号
> - `WaitCondition.distance(robotId, minDist)` — 等待与其他机器人保持距离
> - `WaitCondition.resource(type, id)` — 等待资源可用
> - `WaitCondition.all(...)` — 全部条件满足 (AND)
> - `WaitCondition.race(...)` — 任一条件满足 (OR)
> - `WaitCondition.not(cond)` — 条件取反 (NOT)
>
> 条件满足 → `moving`；条件一直不满足/超时 → `error`

### `CHARGING` — 充电中

```
charging ──→ idle      (充电完成，回到空闲)
         ──→ error     (充电异常)
         ──→ paused    (暂停)
```

### `DOCKING` — 归位/回桩中

```
docking ──→ idle       (归位完成，回到空闲)
        ──→ error      (归位异常)
        ──→ paused     (暂停)
        ──→ charging   (归位后开始充电)
```

### `ERROR` — 异常

```
error ──→ recovering   (开始恢复)
      ──→ idle         (重置到空闲)
      ──→ manual       (转入人工干预)
```

### `RECOVERING` — 恢复中

```
recovering ──→ moving   (恢复成功，继续移动)
            ──→ error   (恢复失败，回到异常)
            ──→ idle    (恢复完成，回到空闲)
```

### `RETURNING` — 返航中

```
returning ──→ docking    (到达停靠点)
          ──→ charging   (直接去充电)
          ──→ error      (返航异常)
          ──→ paused     (暂停)
```

### `MANUAL` — 人工干预

```
manual ──→ idle        (人工放回空闲)
       ──→ moving      (人工指令移动)
       ──→ error       (人工标记异常)
       ──→ recovering  (人工触发恢复)
```

### `PAUSED` — 暂停

```
paused ──→ moving       (恢复移动)
        ──→ dwelling    (恢复停留任务)
        ──→ waiting     (恢复等待)
        ──→ idle        (回到空闲)
```

---

## 状态分类

| 分类 | 包含状态 |
|------|---------|
| 终止状态 | `idle`, `error`, `manual`, `paused` |
| 活跃状态 | `moving`, `rotating`, `arrived`, `dwelling`, `waiting`, `charging`, `docking`, `recovering`, `returning` |

---

## 关键转移路径

### 正常执行流

```
idle → moving → rotating → moving → arrived → dwelling → moving → ... → idle
                                    ↘ waiting ↗          ↘ charging ↗
```

### 低电量返航

```
moving → returning → docking → charging → idle
```

### 异常恢复

```
* → error → recovering → moving → ...
              ↘ error (恢复失败)
              ↘ idle  (放弃恢复)
```

### 人工干预

```
error → manual → idle / moving / recovering
```

### 暂停恢复

```
moving / dwelling / waiting → paused → moving / dwelling / waiting / idle
```
