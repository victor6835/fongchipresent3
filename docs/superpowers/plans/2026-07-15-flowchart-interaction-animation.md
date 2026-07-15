# Flowchart Interaction Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic click-to-advance animation to the active Page13-15 swimlane flowcharts, with orange Pulse/Glow for the current node, deep-blue visited nodes, N-first branch replay, and the approved Page13 customer-confirmation sequence.

**Architecture:** Put the immutable playback tables and interaction state machine in a new testable classic-script module, `flow-interactions.js`. Keep `webpresent.html` responsible only for loading the module, exposing stable `data-node-id` attributes, defining SVG state styles, and binding the controller after all three `buildDio` diagrams exist.

**Tech Stack:** Browser JavaScript, SVG/CSS animations, Node.js built-in test runner, Python `unittest`, Chrome DevTools Protocol.

## Global Constraints

- Apply only to Page13 `#fbox1`, Page14 `#fbox2`, and Page15 `#fbox3`.
- Do not change any node text, lane, row, offset, size, shape, original color class, edge endpoint, SVG route, or Y/N label.
- Do not activate or modify legacy `FLOWS`, `buildDrawio1`, or legacy play/reset controls.
- Preserve navigation, page numbers, responsive stage scaling, and each page's independent playback progress.
- First left-button pointer press activates the start node; each later press advances exactly one playback step.
- Current nodes retain their original fill and receive a bright-orange Pulse/Glow; visited nodes use deep navy fill and white text.
- Automatic returns wait `700ms`, display the branch endpoint first, and ignore pointer presses while locked.
- Page13 runs the complete new-customer route before the old-customer route.
- Page13 customer confirmation runs dissatisfied-to-end, returns, runs dissatisfied-to-repricing, returns, then takes Y.
- Page14 and Page15 take N before Y at every Y/N decision.
- After a completed page, the next left-button press clears that page and restarts at its first node.
- The workspace is not a Git repository, so no task performs commits.

---

### Task 1: Build the deterministic playback controller with TDD

**Files:**
- Create: `flow-interactions.js`
- Create: `tests/test_flow_interactions.js`

**Interfaces:**
- Produces: global/CommonJS API `FongchiFlowInteractions` with `AUTO_RETURN_MS`, `FLOW_BY_SLIDE`, `FLOW_PLAYBACK`, and `createFlowInteractionController(options)`.
- `createFlowInteractionController` consumes `{ documentRef, setTimer, clearTimer, autoReturnMs }` and returns `{ advance, advanceActive, bindGlobalPointer, reset, getState, destroy }`.
- Controller nodes are resolved with `#<boxId> [data-node-id="<nodeId>"]`.

- [ ] **Step 1: Write the fake DOM test harness**

Create `tests/test_flow_interactions.js` with `FakeClassList`, `FakeNode`, `FakeDocument`, and fake timers. The fake document must support these exact selectors:

```js
'.slide.active'
'#fbox1 [data-node-id="st"]'
'#fbox1 [data-node-id]'
```

The helper must create all unique IDs found in `FLOW_PLAYBACK` for `fbox1`, `fbox2`, and `fbox3`, expose `setActiveSlide(id)`, and dispatch capture-phase `pointerdown` events.

- [ ] **Step 2: Write failing playback-table tests**

Require `../flow-interactions.js` and assert these exact immutable step lists:

```js
const expected = {
  fbox1: [
    'st', 'n1', 'n2', 'no', ['end1', 'n2'], 'yes', 'n3', 'nc', 'f1',
    'n5', 'n6', 'n7', 'n7n', ['end2', 'n7'], 'n7n', 'n5', 'n6',
    'n7', 'n8', ['c2', 'n3'], 'oc', 'f2', 'n8', 'c2',
  ],
  fbox2: [
    'c1', 'n9', 'b1', 'b2', 'b2n', ['b3', 'b2'], 'b3', 'b4', 'b5',
    'b6', 'b6n', 'b4', 'b5', 'b6', 'c3',
  ],
  fbox3: [
    'c2b', 'w1', 'w2', 'w3', 'w4', ['c1b', 'w4'],
    'a1', 'a2', 'a3', 'pay', 'fin',
  ],
};
```

Normalize `{ id, autoReturn }` objects to strings or `[id, autoReturn]` before comparing. Also assert `Object.isFrozen(FLOW_PLAYBACK)`, every sequence, and every step.

- [ ] **Step 3: Write failing controller behavior tests**

Add tests that prove:

```js
// First press: only start is current.
controller.advance('fbox1');
assert.ok(node('fbox1', 'st').classList.contains('flow-current'));

// Second press: start becomes visited and n1 becomes current.
controller.advance('fbox1');
assert.ok(node('fbox1', 'st').classList.contains('flow-visited'));
assert.ok(node('fbox1', 'n1').classList.contains('flow-current'));

// end1 locks, ignores another advance, then automatically returns to n2.
advanceTimes(controller, 'fbox1', 3);
assert.equal(controller.getState('fbox1').locked, true);
assert.equal(controller.advance('fbox1').status, 'locked');
timers.runNext();
assert.equal(controller.getState('fbox1').currentId, 'n2');

// Global pointer binding advances only the active Page13-15 flow and ignores right click.
documentRef.setActiveSlide('s8');
documentRef.dispatchPointer({ button: 0 });
assert.equal(controller.getState('fbox2').currentId, 'c1');
documentRef.dispatchPointer({ button: 2 });
assert.equal(controller.getState('fbox2').index, 0);
```

Add separate tests for independent page state, Page13 new-before-old ordering, all automatic returns, lock behavior, completion restart, and `destroy()` clearing timers/listeners.

- [ ] **Step 4: Run the Node tests and confirm RED**

Run:

```bash
node --test tests/test_flow_interactions.js
```

Expected: FAIL with `Cannot find module '../flow-interactions.js'`.

- [ ] **Step 5: Implement the immutable playback API**

Create `flow-interactions.js` as a classic-script/CommonJS-compatible IIFE:

```js
(function attachFlowInteractions(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FongchiFlowInteractions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  'use strict';

  const AUTO_RETURN_MS = 700;
  const FLOW_BY_SLIDE = Object.freeze({ s7: 'fbox1', s8: 'fbox2', s9: 'fbox3' });
  const freezeSteps = (steps) => Object.freeze(steps.map((step) => Object.freeze(
    typeof step === 'string' ? { id: step } : { ...step },
  )));
  const FLOW_PLAYBACK = Object.freeze({
    fbox1: freezeSteps([
      'st', 'n1', 'n2', 'no', { id: 'end1', autoReturn: 'n2' },
      'yes', 'n3', 'nc', 'f1', 'n5', 'n6', 'n7', 'n7n',
      { id: 'end2', autoReturn: 'n7' }, 'n7n', 'n5', 'n6', 'n7', 'n8',
      { id: 'c2', autoReturn: 'n3' }, 'oc', 'f2', 'n8', 'c2',
    ]),
    fbox2: freezeSteps([
      'c1', 'n9', 'b1', 'b2', 'b2n', { id: 'b3', autoReturn: 'b2' },
      'b3', 'b4', 'b5', 'b6', 'b6n', 'b4', 'b5', 'b6', 'c3',
    ]),
    fbox3: freezeSteps([
      'c2b', 'w1', 'w2', 'w3', 'w4', { id: 'c1b', autoReturn: 'w4' },
      'a1', 'a2', 'a3', 'pay', 'fin',
    ]),
  });
```

Implement state with immutable replacements:

```js
let states = Object.freeze(Object.fromEntries(
  Object.keys(FLOW_PLAYBACK).map((boxId) => [boxId, Object.freeze({
    index: -1, currentId: null, locked: false, timerId: null,
  })]),
));

function replaceState(boxId, patch) {
  states = Object.freeze({
    ...states,
    [boxId]: Object.freeze({ ...states[boxId], ...patch }),
  });
  return states[boxId];
}
```

`advance(boxId)` must perform these operations in order:

1. Return `{ status: 'inactive' }` for unknown boxes.
2. Return `{ status: 'locked' }` without DOM changes while `locked`.
3. If the sequence is complete, clear that box, set index `-1`, then continue to index `0` with `restarted: true`.
4. Mark the old current node `flow-visited`, remove `flow-current`, remove `flow-visited` from the next node, and add `flow-current` to the next node.
5. Replace state with the new index and current id.
6. For `autoReturn`, set `locked: true`, schedule exactly one timer, then mark the endpoint visited and the return target current after `autoReturnMs`.

`bindGlobalPointer` must use capture phase:

```js
eventTarget.addEventListener('pointerdown', onPointerDown, true);
```

The handler calls `advanceActive()` only when `event.button === 0`.

- [ ] **Step 6: Run the Node tests and confirm GREEN**

Run:

```bash
node --test tests/test_flow_interactions.js
```

Expected: all controller tests pass.

---

### Task 2: Integrate stable SVG node identifiers and controller startup

**Files:**
- Modify: `webpresent.html` (`<head>`, `buildDio` node group creation, and post-`buildDio` startup only)
- Modify: `tests/test_webpresent.py`
- Test: `.agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs`

**Interfaces:**
- Consumes: `window.FongchiFlowInteractions.createFlowInteractionController` from Task 1.
- Produces: `window.dioFlowController` for browser QA and one `data-node-id` per active `.dio` group.

- [ ] **Step 1: Add failing HTML integration tests**

Add Python assertions that require:

```python
self.assertIn('<script src="flow-interactions.js"></script>', self.source)
self.assertIn("'data-node-id': n.id", self.source)
self.assertIn(
    "FongchiFlowInteractions.createFlowInteractionController({ documentRef: document })",
    self.source,
)
self.assertIn("dioFlowController.bindGlobalPointer(document)", self.source)
self.assertIn("window.dioFlowController = dioFlowController", self.source)
```

Also assert the local interaction script appears before the external three.js script and that initialization appears after the active `fbox3` call.

- [ ] **Step 2: Run the Python test and confirm RED**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_flow_interaction_controller_is_integrated
```

Expected: FAIL because the local script and controller startup are absent.

- [ ] **Step 3: Load the controller before external visual dependencies**

Add to `<head>` before the three.js CDN script:

```html
<script src="flow-interactions.js"></script>
```

- [ ] **Step 4: Add stable IDs without changing SVG geometry**

Change only the active `buildDio` node group creation:

```js
const g = el('g', { class: 'dio ' + n.css, 'data-node-id': n.id });
```

- [ ] **Step 5: Start and expose the controller**

Immediately after all three active `buildDio` calls, add:

```js
const dioFlowController = FongchiFlowInteractions.createFlowInteractionController({ documentRef: document });
dioFlowController.bindGlobalPointer(document);
window.dioFlowController = dioFlowController;
```

- [ ] **Step 6: Run integration and flow-source tests**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_flow_interaction_controller_is_integrated
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
```

Expected: integration test passes; active flow counts remain `18/19`, `11/12`, and `11/10`.

---

### Task 3: Add current and visited visual states with TDD

**Files:**
- Modify: `webpresent.html` (flowchart CSS only)
- Modify: `tests/test_webpresent.py`

**Interfaces:**
- Consumes: `flow-current` and `flow-visited` classes emitted by Task 1.
- Produces: stable orange current-node styling, deep-navy visited styling, and reduced-motion behavior.

- [ ] **Step 1: Add failing CSS contract tests**

Add a Python test that extracts these selectors and asserts exact properties:

```text
.dio.flow-current .shape
.dio.flow-visited .shape
.dio.flow-visited text
@keyframes dioNodePulse
@media (prefers-reduced-motion: reduce)
```

Require `#FF8A00`, `#0D2B5C`, white visited text, `animation: dioNodePulse 1.1s ease-in-out infinite`, and no `transform` inside the keyframes.

- [ ] **Step 2: Run the CSS test and confirm RED**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_flow_interaction_visual_states
```

Expected: FAIL because the state selectors do not exist.

- [ ] **Step 3: Add exact SVG state styles**

Add after the existing `.dio.conn .shape` rule:

```css
.dio.flow-current .shape {
  stroke: #FF8A00 !important;
  stroke-width: 5 !important;
  filter: drop-shadow(0 0 5px rgba(255, 138, 0, .9)) drop-shadow(0 0 12px rgba(255, 138, 0, .7));
  animation: dioNodePulse 1.1s ease-in-out infinite
}

.dio.flow-visited .shape {
  fill: #0D2B5C !important;
  stroke: #0D2B5C !important;
  stroke-dasharray: none !important;
  filter: none;
  animation: none
}

.dio.flow-visited text,
.dio.flow-visited .subt {
  fill: #FFFFFF !important
}

@keyframes dioNodePulse {
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(255, 138, 0, .75)) drop-shadow(0 0 9px rgba(255, 138, 0, .55))
  }
  50% {
    filter: drop-shadow(0 0 9px rgba(255, 138, 0, 1)) drop-shadow(0 0 18px rgba(255, 138, 0, .9))
  }
}

@media (prefers-reduced-motion: reduce) {
  .dio.flow-current .shape {
    animation: none
  }
}
```

- [ ] **Step 4: Run the CSS and full source tests**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
node --test tests/test_flow_interactions.js
```

Expected: all tests pass.

---

### Task 4: Verify complete browser routing and visual behavior

**Files:**
- Test: rendered `webpresent.html`
- Test: `flow-interactions.js`

**Interfaces:**
- Consumes: `window.dioFlowController` and real SVG classes.
- Produces: runtime evidence for all routes, auto returns, visual states, and page independence.

- [ ] **Step 1: Start or reuse the local server**

Run:

```bash
/usr/bin/python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/webpresent.html#13`.

- [ ] **Step 2: Verify first and second clicks visually and geometrically**

Dispatch real left-button `pointerdown` events and assert:

```js
window.dioFlowController.getState('fbox1').currentId === 'st'
```

After the second event:

```js
document.querySelector('#fbox1 [data-node-id="st"]').classList.contains('flow-visited')
document.querySelector('#fbox1 [data-node-id="n1"]').classList.contains('flow-current')
```

Check computed styles: current stroke is `rgb(255, 138, 0)`, visited fill is `rgb(13, 43, 92)`, and visited text is white. Compare all node `getBBox()` values before and after state changes; geometry must be identical.

- [ ] **Step 3: Verify all Page13 route events**

Record current IDs after every pointer event and after every automatic timer. Expected clicked-node order:

```text
st,n1,n2,no,end1,yes,n3,nc,f1,n5,n6,n7,n7n,end2,n7n,n5,n6,n7,n8,c2,oc,f2,n8,c2
```

Expected automatic returns:

```text
end1->n2
end2->n7
c2(new customer)->n3
```

During each `700ms` wait, an extra pointer event must leave index/current id unchanged.

- [ ] **Step 4: Verify Page14 and Page15 routes**

Expected Page14 clicked-node order:

```text
c1,n9,b1,b2,b2n,b3,b3,b4,b5,b6,b6n,b4,b5,b6,c3
```

Expected Page14 automatic return: `b3->b2` after the N material branch.

Expected Page15 clicked-node order:

```text
c2b,w1,w2,w3,w4,c1b,a1,a2,a3,pay,fin
```

Expected Page15 automatic return: `c1b->w4`.

- [ ] **Step 5: Verify global trigger, page independence, and restart**

Confirm right-button pointer events do nothing. Advance Page13, navigate to Page14, advance it, return to Page13, and assert both indices are preserved independently. Finish one page, click once more, and assert only that page resets with its first node current.

- [ ] **Step 6: Capture visual evidence**

Capture Page13 with at least one visited node and one current node at:

```text
1920x1080
1280x720
768x1024
375x667
667x375
```

At every viewport verify the glow is visible, visited text remains legible, all flow content stays in-frame, and controls/page number do not cover a node.

---

### Task 5: Final regression and independent review

**Files:**
- Review: `flow-interactions.js`
- Review: `webpresent.html`
- Review: `tests/test_flow_interactions.js`
- Review: `tests/test_webpresent.py`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: final passing test and review evidence.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
node --test tests/test_flow_interactions.js
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
```

Expected: all Node and Python tests pass; all three source verifier checks pass.

- [ ] **Step 2: Reconfirm untouched flow data**

Use the verifier parser to compare `fbox1`, `fbox2`, and `fbox3` parsed-data hashes with the pre-edit baselines. Node/edge counts, every node invariant, and every ordered endpoint must remain unchanged.

- [ ] **Step 3: Run independent review**

Reviewer must report findings first, then explicit verdicts:

```text
Spec compliance: PASS
Code quality: APPROVED
```

Resolve and re-review every blocking finding before completion.

- [ ] **Step 4: Stop QA-only browser processes**

Close CDP/headless Chrome processes and QA tabs. Keep the local HTTP server running only if it is being handed to the user with the preview URL.

