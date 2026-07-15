# Flowchart Reset And Node Jump Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-flow reset controls, click-to-start-from-node behavior, and automatic-return branch cleanup to the active Page13-15 flowcharts.

**Architecture:** Keep playback data and all interaction state transitions in `flow-interactions.js`. Extend its immutable controller with `startAt(boxId, nodeId)` and target-aware capture-phase pointer routing; keep `webpresent.html` limited to creating three accessible reset buttons, styling them beside the page number, and binding keyboard activation.

**Tech Stack:** Browser JavaScript, SVG/CSS, Node.js built-in test runner, Python `unittest`, Chrome DevTools Protocol.

## Global Constraints

- Apply only to Page13 `#fbox1`, Page14 `#fbox2`, and Page15 `#fbox3`.
- Preserve every existing `FLOW_PLAYBACK` step and the active `buildDio` node/edge data.
- Preserve N-first routing, Page13 new-customer-before-old-customer routing, 700ms endpoint visibility, per-page state independence, and completion restart.
- Reset leaves index `-1`, no current node, and every node at its original color.
- Node selection clears all state, chooses the first playback occurrence, and makes only the selected node current.
- A node or reset pointer event performs one action only and never also performs ordinary advancement.
- Automatic return clears every traversed node after the returned decision through the endpoint.
- Do not modify legacy `FLOWS`, `buildDrawio1`, legacy controls, page-number position, navigation order, flow geometry, node text, edge labels, or route definitions.
- The workspace is not a Git repository, so no task performs commits.

---

### Task 1: Extend the controller with reset targeting, node starts, and branch cleanup

**Files:**
- Modify: `flow-interactions.js`
- Modify: `tests/test_flow_interactions.js`
- Create: `.superpowers/sdd/flow-reset-task-1-report.md`

**Interfaces:**
- Consumes: existing `FLOW_BY_SLIDE`, `FLOW_PLAYBACK`, immutable state records, injected timers, and `[data-node-id]` DOM groups.
- Produces: `startAt(boxId, nodeId)` and target-aware `bindGlobalPointer(eventTarget)` behavior.

- [ ] **Step 1: Extend the fake DOM for descendant and control targets**

Update `FakeNode` to know its box and resolve the active-flow selector:

```js
class FakeNode {
  constructor(nodeId, boxId) {
    this.dataset = { nodeId };
    this.boxId = boxId;
    this.classList = new FakeClassList();
  }

  closest(selector) {
    if (selector === `#${this.boxId} [data-node-id]`) return this;
    return null;
  }
}
```

Create child and reset targets so the capture handler is tested against the same `closest()` behavior used by SVG shapes/text and the reset button:

```js
class FakeChildTarget {
  constructor(parent) { this.parent = parent; }
  closest(selector) { return this.parent.closest(selector); }
}

class FakeResetTarget {
  constructor(boxId) { this.dataset = { flowReset: boxId }; }
  closest(selector) { return selector === '[data-flow-reset]' ? this : null; }
}
```

Construct nodes with `new FakeNode(id, boxId)` and keep `dispatchPointer(event)` forwarding the complete event object.

- [ ] **Step 2: Write failing reset and `startAt` tests**

Add tests with these exact behavioral assertions:

```js
test('reset cancels a locked return and restores every node to its original state', () => {
  const { controller, documentRef, timers } = createFixture();
  advanceTimes(controller, 'fbox1', 5);
  assert.equal(controller.getState('fbox1').locked, true);

  assert.deepEqual(controller.reset('fbox1'), { status: 'reset' });

  assert.deepEqual(controller.getState('fbox1'), {
    index: -1, currentId: null, locked: false, timerId: null,
  });
  assert.equal(timers.pendingCount(), 0);
  documentRef.querySelectorAll('#fbox1 [data-node-id]').forEach((routeNode) => {
    assert.equal(routeNode.classList.contains('flow-current'), false);
    assert.equal(routeNode.classList.contains('flow-visited'), false);
  });
});

test('startAt clears prior state and selects the first duplicate occurrence', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox1', 4);

  assert.deepEqual(controller.startAt('fbox1', 'n5'), {
    status: 'started', id: 'n5', index: 9,
  });

  assert.equal(controller.getState('fbox1').index, 9);
  assert.equal(controller.getState('fbox1').currentId, 'n5');
  documentRef.querySelectorAll('#fbox1 [data-node-id]').forEach((routeNode) => {
    assert.equal(routeNode.classList.contains('flow-visited'), false);
    assert.equal(routeNode.classList.contains('flow-current'), routeNode.dataset.nodeId === 'n5');
  });
});

test('startAt schedules the first automatic occurrence and rejects unknown nodes', () => {
  const { controller, timers } = createFixture();
  assert.deepEqual(controller.startAt('fbox2', 'b3'), {
    status: 'started', id: 'b3', index: 5,
  });
  assert.equal(controller.getState('fbox2').locked, true);
  assert.equal(timers.pendingCount(), 1);
  assert.equal(controller.startAt('fbox2', 'missing').status, 'inactive');
});
```

- [ ] **Step 3: Write failing branch-cleanup tests**

Extend the endpoint test so `no` and `end1` are original after `end1 -> n2`, while nodes before `n2` retain their state:

```js
timers.runNext();
assert.equal(controller.getState('fbox1').currentId, 'n2');
for (const nodeId of ['no', 'end1']) {
  assert.equal(node(documentRef, 'fbox1', nodeId).classList.contains('flow-current'), false);
  assert.equal(node(documentRef, 'fbox1', nodeId).classList.contains('flow-visited'), false);
}
assert.equal(node(documentRef, 'fbox1', 'n2').classList.contains('flow-current'), true);
assert.equal(node(documentRef, 'fbox1', 'n1').classList.contains('flow-visited'), true);
```

Add explicit checks for the longer and cross-page cleanup segments:

```js
test('automatic returns clear only nodes after their decision', () => {
  const { controller, documentRef, timers } = createFixture();

  advanceTimes(controller, 'fbox1', 5); timers.runNext();
  advanceTimes(controller, 'fbox1', 9); timers.runNext();
  for (const nodeId of ['n7n', 'end2']) {
    assert.equal(node(documentRef, 'fbox1', nodeId).classList.contains('flow-visited'), false);
  }

  advanceTimes(controller, 'fbox1', 6); timers.runNext();
  for (const nodeId of ['nc', 'f1', 'n5', 'n6', 'n7', 'n7n', 'end2', 'n8', 'c2']) {
    const routeNode = node(documentRef, 'fbox1', nodeId);
    assert.equal(routeNode.classList.contains('flow-current'), false);
    assert.equal(routeNode.classList.contains('flow-visited'), false);
  }
  assert.equal(node(documentRef, 'fbox1', 'n3').classList.contains('flow-current'), true);

  advanceTimes(controller, 'fbox2', 6); timers.runNext();
  for (const nodeId of ['b2n', 'b3']) {
    assert.equal(node(documentRef, 'fbox2', nodeId).classList.contains('flow-visited'), false);
  }

  advanceTimes(controller, 'fbox3', 6); timers.runNext();
  assert.equal(node(documentRef, 'fbox3', 'c1b').classList.contains('flow-visited'), false);
});
```

- [ ] **Step 4: Write failing pointer-priority tests**

Add one test proving child-node and reset targets do not fall through to ordinary advancement:

```js
test('global pointer prioritizes reset and node targets without double advancement', () => {
  const { controller, documentRef } = createFixture();
  controller.bindGlobalPointer(documentRef);
  documentRef.setActiveSlide('s8');

  const b3 = node(documentRef, 'fbox2', 'b3');
  documentRef.dispatchPointer({ button: 0, target: new FakeChildTarget(b3) });
  assert.equal(controller.getState('fbox2').index, 5);
  assert.equal(controller.getState('fbox2').currentId, 'b3');

  documentRef.dispatchPointer({ button: 0, target: new FakeResetTarget('fbox2') });
  assert.equal(controller.getState('fbox2').index, -1);
  assert.equal(controller.getState('fbox2').currentId, null);

  documentRef.dispatchPointer({ button: 0, target: null });
  assert.equal(controller.getState('fbox2').currentId, 'c1');
});
```

Keep the existing right-button test and add a mismatched reset target assertion that leaves the active flow unchanged.

- [ ] **Step 5: Run the Node tests and confirm RED**

Run:

```bash
node --test tests/test_flow_interactions.js
```

Expected: failures because `startAt` is absent, automatic-return branch nodes remain visited, and pointer targets still call ordinary `advanceActive()`.

- [ ] **Step 6: Implement shared step activation and automatic-return cleanup**

Add these helpers inside `createFlowInteractionController`:

```js
function scheduleAutoReturn(boxId, step) {
  if (!step.autoReturn) return states[boxId];
  const timerId = setTimer(() => returnFromEndpoint(boxId, step.autoReturn), autoReturnMs);
  return replaceState(boxId, { locked: true, timerId });
}

function clearStepRange(boxId, fromIndex, throughIndex) {
  const ids = new Set(
    FLOW_PLAYBACK[boxId].slice(fromIndex, throughIndex + 1).map((step) => step.id),
  );
  ids.forEach((nodeId) => {
    findNode(boxId, nodeId)?.classList.remove('flow-current', 'flow-visited');
  });
}

function returnFromEndpoint(boxId, returnId) {
  const state = states[boxId];
  const steps = FLOW_PLAYBACK[boxId];
  let decisionIndex = state.index - 1;
  while (decisionIndex >= 0 && steps[decisionIndex].id !== returnId) decisionIndex -= 1;
  clearStepRange(boxId, Math.max(0, decisionIndex + 1), state.index);
  const returnNode = findNode(boxId, returnId);
  returnNode?.classList.remove('flow-visited');
  returnNode?.classList.add('flow-current');
  replaceState(boxId, { currentId: returnId, locked: false, timerId: null });
}
```

Replace the inline timer block in `advance` with:

```js
scheduleAutoReturn(boxId, step);
```

- [ ] **Step 7: Implement `startAt`**

Add:

```js
function startAt(boxId, nodeId) {
  const steps = FLOW_PLAYBACK[boxId];
  if (!steps) return { status: 'inactive' };
  const index = steps.findIndex((step) => step.id === nodeId);
  const nextNode = index >= 0 ? findNode(boxId, nodeId) : null;
  if (index < 0 || !nextNode) return { status: 'inactive' };

  clearTimerFor(boxId);
  clearClasses(boxId);
  nextNode.classList.add('flow-current');
  replaceState(boxId, {
    index, currentId: nodeId, locked: false, timerId: null,
  });
  scheduleAutoReturn(boxId, steps[index]);
  return { status: 'started', id: nodeId, index };
}
```

Expose it in the returned controller API:

```js
return { advance, advanceActive, startAt, bindGlobalPointer, reset, getState, destroy };
```

- [ ] **Step 8: Implement target-aware global pointer routing**

Replace the pointer handler with:

```js
pointerHandler = (event) => {
  if (event.button !== 0) return;
  const activeSlide = documentRef?.querySelector('.slide.active');
  const boxId = activeSlide && FLOW_BY_SLIDE[activeSlide.id];
  if (!boxId) return;

  const resetTarget = event.target?.closest?.('[data-flow-reset]');
  if (resetTarget) {
    if (resetTarget.dataset.flowReset === boxId) reset(boxId);
    return;
  }

  const nodeTarget = event.target?.closest?.(`#${boxId} [data-node-id]`);
  if (nodeTarget) {
    startAt(boxId, nodeTarget.dataset.nodeId);
    return;
  }

  advance(boxId);
};
```

- [ ] **Step 9: Run Task 1 verification and record evidence**

Run:

```bash
node --test tests/test_flow_interactions.js
node --check flow-interactions.js
```

Expected: all interaction tests pass and syntax checking succeeds. Record RED/GREEN output, timer counts, duplicate index evidence, and branch cleanup assertions in `.superpowers/sdd/flow-reset-task-1-report.md`.

---

### Task 2: Add accessible reset controls beside flow page numbers

**Files:**
- Modify: `webpresent.html` (reset-control CSS and post-controller button creation only)
- Modify: `tests/test_webpresent.py`
- Create: `.superpowers/sdd/flow-reset-task-2-report.md`

**Interfaces:**
- Consumes: `FongchiFlowInteractions.FLOW_BY_SLIDE` and `dioFlowController.reset(boxId)`.
- Produces: three `.flowReset[data-flow-reset]` buttons, one on each active flow slide.

- [ ] **Step 1: Write the failing source/integration test**

Add:

```python
def test_flow_reset_controls_are_integrated_beside_page_numbers(self):
    reset = css_block(self.source, ".flowReset")
    declarations = css_declarations(reset)
    self.assertEqual("absolute", declarations["position"])
    self.assertEqual("210px", declarations["right"])
    self.assertEqual("18px", declarations["bottom"])
    self.assertEqual("8px", declarations["border-radius"])
    self.assertIn("z-index", declarations)

    self.assertIn(
        "Object.entries(FongchiFlowInteractions.FLOW_BY_SLIDE).forEach",
        self.source,
    )
    self.assertIn("button.type = 'button'", self.source)
    self.assertIn("button.className = 'flowReset'", self.source)
    self.assertIn("button.dataset.flowReset = boxId", self.source)
    self.assertIn("button.textContent = '↺ 回到起始'", self.source)
    self.assertIn("if (event.detail === 0) dioFlowController.reset(boxId)", self.source)
    self.assertIn("document.getElementById(slideId).appendChild(button)", self.source)
    self.assertIn("if (e.target.closest?.('.flowReset')) return", self.source)

    page_number = css_block(self.source, ".pgno")
    self.assertEqual("90px", css_declarations(page_number)["right"])
    self.assertEqual("26px", css_declarations(page_number)["bottom"])
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_flow_reset_controls_are_integrated_beside_page_numbers
```

Expected: FAIL because `.flowReset` and the button-creation loop are absent.

- [ ] **Step 3: Add the reset-control CSS**

Add immediately after the `.pgno` rule:

```css
.flowReset {
  position: absolute;
  right: 210px;
  bottom: 18px;
  z-index: 22;
  height: 42px;
  padding: 0 14px;
  border: 1px solid #9BB4D8;
  border-radius: 8px;
  background: #FFFFFF;
  color: var(--blue-d);
  font: 700 19px/1 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
  cursor: pointer;
  box-shadow: 0 5px 14px rgba(13, 43, 92, .14)
}

.flowReset:hover {
  border-color: var(--blue);
  color: var(--blue)
}

.flowReset:focus-visible {
  outline: 3px solid #FF8A00;
  outline-offset: 3px
}
```

- [ ] **Step 4: Create and bind exactly three buttons**

Immediately after exposing `window.dioFlowController`, add:

```js
Object.entries(FongchiFlowInteractions.FLOW_BY_SLIDE).forEach(([slideId, boxId]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'flowReset';
  button.dataset.flowReset = boxId;
  button.textContent = '↺ 回到起始';
  button.setAttribute('aria-label', '回到起始');
  button.addEventListener('click', (event) => {
    if (event.detail === 0) dioFlowController.reset(boxId);
  });
  document.getElementById(slideId).appendChild(button);
});
```

Pointer activation resets once in the controller's capture handler. Keyboard/programmatic click activation has `detail === 0` and resets through the button handler.

Prevent the presentation's global Space-key navigation from consuming keyboard activation on the reset control. Add this as the first line inside the existing `keydown` listener:

```js
if (e.target.closest?.('.flowReset')) return;
```

Enter and Space can then produce the button's normal keyboard click without changing slides.

- [ ] **Step 5: Run Task 2 regression checks**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
node --test tests/test_flow_interactions.js
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
```

Expected: all Python and Node tests pass; flow counts remain `18/19`, `11/12`, and `11/10`. Record the RED/GREEN and integration evidence in `.superpowers/sdd/flow-reset-task-2-report.md`.

---

### Task 3: Verify real-browser reset, node start, cleanup, and responsive placement

**Files:**
- Test: rendered `webpresent.html`
- Test: `flow-interactions.js`
- Create: `.superpowers/sdd/flow-reset-task-3-report.md`

**Interfaces:**
- Consumes: `window.dioFlowController`, `.flowReset[data-flow-reset]`, and active SVG node groups.
- Produces: runtime evidence for one-action pointer routing, timer cancellation, cleanup, geometry stability, accessibility activation, and five-viewport layout.

- [ ] **Step 1: Start or reuse the loopback preview server**

Run:

```bash
/usr/bin/python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/webpresent.html#13` in an isolated headless Chrome/CDP session.

- [ ] **Step 2: Verify reset behavior and timer cancellation**

In real DOM automation:

```js
const left = (target = document) => target.dispatchEvent(new PointerEvent(
  'pointerdown', { button: 0, bubbles: true },
));
left(); left();
const resetButton = document.querySelector('#s7 .flowReset');
left(resetButton);
```

Assert:

```js
window.dioFlowController.getState('fbox1').index === -1
window.dioFlowController.getState('fbox1').currentId === null
document.querySelectorAll('#fbox1 .flow-current, #fbox1 .flow-visited').length === 0
```

Advance to locked `end1`, press the reset control, wait at least `800ms`, and assert no stale timer reactivates `n2`.

Call `resetButton.click()` after partial progress and assert the keyboard/programmatic click path produces the same reset.

- [ ] **Step 3: Verify node targeting and no double advancement**

Press the `.shape` child of Page13 `n5` and assert:

```js
const state = window.dioFlowController.getState('fbox1');
state.index === 9 && state.currentId === 'n5' && state.locked === false
document.querySelectorAll('#fbox1 .flow-current').length === 1
document.querySelector('#fbox1 [data-node-id="n5"]').classList.contains('flow-current')
document.querySelectorAll('#fbox1 .flow-visited').length === 0
```

On Page14, press the text/shape child of `b3` and assert it selects index `5`, remains current for the 700ms endpoint interval, then returns to `b2`. This proves first-occurrence selection and that the pointer event did not also advance to the second `b3` occurrence.

- [ ] **Step 4: Verify automatic-return branch cleanup**

Exercise all automatic returns and inspect classes after each timer:

```text
end1->n2: no,end1 original
end2->n7: n7n,end2 original
c2->n3: nc,f1,n5,n6,n7,n7n,end2,n8,c2 original
b3->b2: b2n,b3 original
c1b->w4: c1b original
```

At each return, assert the decision node alone is `flow-current` within the cleaned segment and nodes before the decision retain their prior state.

- [ ] **Step 5: Verify geometry and five viewport layouts**

Capture `getBBox()` for every active node before interaction, then compare after reset, node selection, and automatic cleanup; every value must remain identical.

For each viewport, set the metrics before loading the page, advance to one visited and one current node, then capture a screenshot:

```text
1920x1080
1280x720
768x1024
375x667
667x375
```

At each size assert:

- the reset button is left of the page number and vertically aligned;
- neither reset control nor page number intersects any flow node;
- the control stays inside the viewport;
- current/visited computed styles remain orange/deep-blue/white;
- all flow SVG content remains in frame.

Record the route/state results and screenshot paths in `.superpowers/sdd/flow-reset-task-3-report.md`.

---

### Task 4: Final regression, flow-integrity hashes, and independent review

**Files:**
- Review: `flow-interactions.js`
- Review: `webpresent.html`
- Review: `tests/test_flow_interactions.js`
- Review: `tests/test_webpresent.py`
- Create: `.superpowers/sdd/flow-reset-task-4-report.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: final passing test, unchanged-flow, and review evidence.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
node --test tests/test_flow_interactions.js
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
node --check flow-interactions.js
```

Expected: all tests and syntax checks pass.

- [ ] **Step 2: Reconfirm untouched parsed-flow data**

Use the verifier's `parseFlows` export and SHA-256 over `JSON.stringify(flow)`; require exact matches:

```text
fbox1 624b8a03ab044a24cdd6e546efd0a9f3918f26c0f602dd155b6aa6c7114eddec
fbox2 5d84a895f4253692329379b0a30e0af4836beffc5a68288a5e6043e0efb062a7
fbox3 b8f34d59b472d2179d8297b031924f0b4575d28adc6d4157a077da144551b45c
```

- [ ] **Step 3: Run final independent review**

The reviewer must inspect spec compliance, duplicate-node semantics, timer lifecycle, reset and node event priority, keyboard activation, branch cleanup bounds, immutable state replacement, CSS placement, tests, and unchanged flow data. Findings must lead, followed by explicit verdicts:

```text
Spec compliance: PASS
Code quality: APPROVED
```

Resolve and re-review every blocking finding.

- [ ] **Step 4: Record final evidence and stop QA-only Chrome**

Write test counts, browser QA results, all three hash matches, and reviewer verdicts to `.superpowers/sdd/flow-reset-task-4-report.md`. Close the isolated CDP/headless Chrome process; keep the loopback HTTP server only if handing the preview URL to the user.
