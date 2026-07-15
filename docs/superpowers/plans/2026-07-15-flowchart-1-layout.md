# Flowchart 1 Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Moderately re-layout Page13 `#fbox1` so its decisions, handoffs, return loop, labels, and connector are visually balanced without changing any flow meaning or content.

**Architecture:** Keep the existing data-driven `buildDio` renderer and edit only the active `fbox1` node/edge data plus one reusable orthogonal route branch. Lock the approved geometry with source-level tests, then validate actual SVG geometry and responsive rendering in the browser.

**Tech Stack:** HTML/CSS/JavaScript, SVG, Node.js test runner, Python `unittest`, Playwright browser tools.

## Global Constraints

- Modify only `buildDio`, active `buildDio('fbox1', ...)`, its verifier route allowlist, and focused tests.
- Preserve all 18 node labels, lane assignments, shapes, sizes, colors, Y/N meaning, connector number `1`, and 19 edge endpoints.
- Do not modify `fbox2`, `fbox3`, legacy `FLOWS`, legacy `buildDrawio1`, navigation, page numbers, or unrelated page content.
- The workspace is not a Git repository, so this plan intentionally contains no commit steps.

---

### Task 1: Lock the approved layout in failing source tests

**Files:**
- Modify: `.agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs`
- Read: `webpresent.html`

**Step 1: Add a focused `fbox1` layout contract test**

Add assertions for:

- Exactly 18 nodes and 19 edges.
- Decision-chain rows: `n2=1.2`, `yes/no/end1=2.4`, `n3=3.6`, `nc/oc=4.8`.
- Main-flow rows: `f1/f2=6`, `n5/n6=7`, `n7=8.3`, `n8=9.4`, `n7n=9.9`, `c2=10.7`, `end2=10.9`.
- Symmetric offsets: `yes=-110`, `no=60`, `end1=190`, `nc=-110`, `oc=110`.
- Routes: `f1->n5=downIn`, `n5->n6 side=1`, `n6->n7=downIn`, `n7n->n5=loopL`, `n7->n8=leftIn`, `f2->n8=railR`.
- Compact labels on `n7->n7n` and `n7->n8`.

**Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
```

Expected: FAIL because the approved row values and `railR` route are not implemented yet.

---

### Task 2: Add the right-side design-lane rail route

**Files:**
- Modify: `webpresent.html` (`buildDio` edge routing only)
- Modify: `.agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs`
- Test: `.agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs`

**Step 1: Add `railR` to the verifier allowlist**

Add the route name without changing validation behavior for existing routes.

**Step 2: Implement the SVG route branch**

In `buildDio`, add a `railR` branch that:

- Leaves the source from its right edge.
- Uses a vertical rail 45 SVG units to the right of both endpoint boxes.
- Enters the target from its right edge.
- Keeps label coordinates available even though this edge has no label.

Target path formula:

```js
const xm = Math.max(rgt(A), rgt(B)) + 45;
d = `M${rgt(A)},${cy(A)} L${xm},${cy(A)} L${xm},${cy(B)} L${rgt(B)},${cy(B)}`;
lx = xm + 14;
ly = (cy(A) + cy(B)) / 2;
```

**Step 3: Run verifier unit tests**

Run:

```bash
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
```

Expected: The route is recognized and rendered; the layout contract remains RED until Task 3.

---

### Task 3: Apply the approved medium re-layout to `fbox1`

**Files:**
- Modify: `webpresent.html` (active `buildDio('fbox1', ...)` only)
- Test: `.agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs`

**Step 1: Update node rows and symmetric offsets**

Use this geometry exactly:

| Node | Row | Offset |
|---|---:|---:|
| `st`, `n1` | `0` | unchanged |
| `n2` | `1.2` | unchanged |
| `yes` | `2.4` | `-110` |
| `no` | `2.4` | `60` |
| `end1` | `2.4` | `190` |
| `n3` | `3.6` | `-60` |
| `nc` | `4.8` | `-110` |
| `oc` | `4.8` | `110` |
| `f1`, `f2` | `6` | unchanged |
| `n5`, `n6` | `7` | unchanged |
| `n7` | `8.3` | unchanged |
| `n8` | `9.4` | unchanged |
| `n7n` | `9.9` | unchanged |
| `c2` | `10.7` | unchanged |
| `end2` | `10.9` | unchanged |

**Step 2: Update only the approved edge presentation properties**

- `f1->n5`: `route: 'downIn'`
- `n5->n6`: `side: 1`
- `n6->n7`: `route: 'downIn'`
- `n7->n7n`: retain `N`, add `small: 1` and `loff: [0, -2]`
- `n7n->n5`: `route: 'loopL'`
- `n7->n8`: retain `Y` and `leftIn`, add `small: 1` and `loff: [0, -2]`
- `f2->n8`: `route: 'railR'`

Do not alter any endpoints or other edges.

**Step 3: Run focused tests and confirm GREEN**

Run:

```bash
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
```

Expected: PASS.

**Step 4: Run explicit source expectations**

Run:

```bash
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html \
  --expect-node fbox1:n2:r=1.2 \
  --expect-node fbox1:n7:r=8.3 \
  --expect-node fbox1:n8:r=9.4 \
  --expect-node fbox1:c2:r=10.7 \
  --expect-edge fbox1:f1:n5:route=downIn \
  --expect-edge fbox1:n7n:n5:route=loopL \
  --expect-edge fbox1:f2:n8:route=railR
```

Expected: `PASS all flowchart source checks`.

---

### Task 4: Run regression and SVG geometry verification

**Files:**
- Test: `tests/test_webpresent.py`
- Test: rendered Page13 in a local browser

**Step 1: Run the full project test suite**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
```

Expected: all existing tests pass.

**Step 2: Start the local presentation server**

Run:

```bash
/usr/bin/python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/webpresent.html#13` and navigate to Page13 if the hash is not used by the presentation.

**Step 3: Check rendered structure and geometry**

In the active Page13 `#fbox1 svg`, verify:

- 18 `.dio` node groups and 19 `.dedge` paths.
- Every path has `marker-end="url(#arP1)"`.
- No pair of node bounding boxes overlaps.
- Sampled points on each edge avoid non-endpoint node interiors.
- Y/N label bounding boxes do not overlap nodes.
- Connector `1` remains inside the design lane.
- Browser console has no errors.

Expected: all checks pass. If a geometry check fails, adjust only `fbox1` row/offset or approved route spacing and rerun Tasks 3-4.

---

### Task 5: Responsive visual QA and final review

**Files:**
- Review: `webpresent.html`
- Review: `.agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs`
- Review: `.agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs`

**Step 1: Capture Page13 at all required viewports**

Verify and screenshot:

- `1920x1080`
- `1280x720`
- `768x1024`
- `375x667`
- `667x375`

At each viewport confirm the entire diagram remains inside `flowFull`, nodes and labels are legible, arrows follow intended direction, and navigation/page-number UI does not overlap the diagram.

**Step 2: Review scope and invariants**

Confirm:

- `fbox2` and `fbox3` definitions are byte-for-byte unchanged from the pre-edit capture.
- No text, lane, node shape, edge endpoint, or Y/N meaning changed.
- Only the planned renderer, `fbox1`, verifier, and tests changed.

**Step 3: Re-run all automated checks**

Run:

```bash
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
```

Expected: all checks pass with no browser console errors.

