# Fongchi Flowchart Structure

## Rendered Path

| Slide | Container | Active definition |
|---|---|---|
| Page 13 | `#fbox1` | `buildDio('fbox1', ...)` |
| Page 14 | `#fbox2` | `buildDio('fbox2', ...)` |
| Page 15 | `#fbox3` | `buildDio('fbox3', ...)` |

`const FLOWS`, `buildFlow`, and `buildDrawio1` remain in the file but do not render Page 13-15. Do not edit them unless the call graph changes.

## Lane Indices

| `l` | Role |
|---:|---|
| 0 | 客戶 |
| 1 | 業務 |
| 2 | 設計 |
| 3 | 採購 |
| 4 | 生產 |
| 5 | 工班 |
| 6 | 會計 |

## Key Nodes

| Page | IDs | Purpose |
|---|---|---|
| 7 | `n7`, `n7n`, `n8`, `c2` | 客戶確認、報價不滿、整理檔案、接點 1 |
| 8 | `b2`, `b2n`, `b3`, `b6`, `c3` | 材料判斷、叫料採購、排程確認、品檢、接點 2 |
| 9 | `w4`, `c1b`, `a1`, `a2`, `a3`, `pay`, `fin` | 驗收、接點 1、請款、發票、付款、結案 |

## Node Properties

| Property | Meaning |
|---|---|
| `id` | Stable edge reference |
| `l` | Lane index |
| `r` | Row; decimals are allowed for fine vertical spacing |
| `dx` | Horizontal offset inside a lane |
| `t`, `st` | Visible title and subtitle |
| `sh` | Shape: `r`, `s`, `d`, `p`, `hex`, `op` |
| `w`, `h` | SVG dimensions |
| `css` | Color/style class |

## Edge Properties

| Property | Meaning |
|---|---|
| `f`, `t` | Source and target node IDs |
| `lb` | Visible line label; omit for no text |
| `lc` | Label color |
| `small` | Compact label style |
| `la:'center'` | Center a same-lane label |
| `loff:[x,y]` | Final-resort label offset |
| `side:1` | Direct side-to-side connection |
| `route` | Named orthogonal route |

Implemented routes are `leftIn`, `downIn`, `loopL`, and `brR`. Verify both the edge property and the matching `e.route==='...'` renderer branch.

## Geometry

The renderer computes:

```js
cx = laneCenter(l) + (dx || 0)
cy = HEAD + PADY + r * ROW + ROW / 2
```

For `downIn`, the SVG path must start at the source bottom center and end at the target top center. For a label between two same-lane nodes, its center must lie below the source box and above the target box.

## Browser Gate

At minimum, assert the target slide is active, all three `.flowFull svg` elements exist, no `pageerror` occurs, and the changed node/label/edge geometry matches the request. Capture a settled screenshot after the 450 ms slide animation.
