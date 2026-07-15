---
name: editing-fongchi-flowcharts
description: Use when modifying Page 13-15 swimlane flowcharts in Fongchi's webpresent.html, including node lanes or rows, connector numbers, SVG edge routes, Y/N branches, line labels, or payment-flow wording.
---

# Editing Fongchi Flowcharts

## Overview

Treat the lower `buildDio('fbox1'..'fbox3')` calls as the rendered source of truth. Make the smallest requested change and prove both source invariants and browser geometry.

**REQUIRED SUB-SKILL:** Use `frontend-slides` for viewport and screenshot validation.
**REQUIRED SUB-SKILL:** Use `tdd-workflow` before changing the HTML.
**REQUIRED SUB-SKILL:** Use `verification-before-completion` before handoff.

Read [references/flowchart-structure.md](references/flowchart-structure.md) before editing.

## Workflow

1. Map Page 13/14/15 to `fbox1`/`fbox2`/`fbox3`; ignore inactive `FLOWS` and `buildDrawio1` definitions.
2. Translate the request with the contract below. Role wording identifies a lane; it does not rename node text.
3. Run a failing source assertion before editing.
4. Patch only the active node, edge, or route branch required by the request.
5. Run the verifier again, then inspect the rendered SVG at `1600x900` and the frontend-slides viewport set.
6. Confirm labels do not overlap nodes or lines and review only the touched lines.

## Edit Contract

| Request | Property to change |
|---|---|
| Move to a role/column | Node `l` only |
| Move up/down | Node `r`; shift downstream nodes only when spacing requires it |
| Change connector number | Connector node `t` only |
| Add/move line text | Edge `lb`; use `la:'center'` for centered same-lane labels |
| Remove line text | Remove edge `lb` |
| Change connection direction | Edge `route`, plus a matching renderer branch if absent |

Do not infer display-text changes from phrases such as "客戶角色的付款". Change `t` only when the user explicitly asks to rename visible text.

## Verification Tool

```bash
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html \
  --expect-node fbox3:c1b:l=2 \
  --expect-edge fbox3:a3:pay:lb=收款 \
  --expect-no-label fbox3:pay:fin
```

The verifier parses only active `buildDio` calls, checks node IDs, lane bounds, edge references, route implementations, and requested properties. Source checks do not replace browser geometry checks.

## Common Mistakes

- Editing legacy `FLOWS` or the unused `buildDrawio1` function.
- Changing a node label when the request names a role or swimlane.
- Setting `route:'downIn'` without confirming `buildDio` implements `downIn`.
- Moving a label with large offsets before trying `la:'center'`.
- Claiming a visual fix from regex checks without a screenshot and SVG endpoint assertions.
