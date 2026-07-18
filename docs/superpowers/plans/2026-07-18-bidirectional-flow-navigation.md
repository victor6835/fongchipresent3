# Bidirectional Flow Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make on-screen buttons change slides directly while projector controls traverse Pages 13-15 in both directions, resume branches only on user input, reset flows on slide exit, and follow the approved Page 13 quote-objection route.

**Architecture:** Keep `flow-interactions.js` as the owner of immutable playback data and flow state. Replace timer-driven returns with deterministic rendering from a playback index plus `resumeFrom`/`resumeVia` metadata, then let `webpresent.html` translate controller boundary results into slide changes through the existing `go(i)` function.

**Tech Stack:** Vanilla JavaScript, CommonJS-compatible browser module, Node.js built-in test runner, Python `unittest`, local Playwright/Chromium verification, static HTML/SVG presentation.

## Global Constraints

- Work only in `/Users/zhuangchengfu/Downloads/fongchipresent 2/.worktrees/flow-first-forward-navigation` on `codex/flow-first-forward-navigation`.
- Preserve the uncommitted user edits already present in `webpresent.html`, including `產能充足？`, `新舊案?`, `報價異議`, and `舊案沿用歷史價格`.
- Treat active `buildDio('fbox1'..'fbox3')` definitions as the rendered Page 13-15 source of truth; do not edit node geometry, edges, routes, labels, or CSS.
- `btnPrev` and `btnNext` always change slides and reset a departing active flow.
- Forward keys are `ArrowRight`, `ArrowDown`, `PageDown`, Space, and `Enter`; backward keys are `ArrowLeft`, `ArrowUp`, `PageUp`, and `Backspace`.
- Remove all timed, locked, and automatic return behavior.
- Use `PYTHONDONTWRITEBYTECODE=1` for Python tests so tracked bytecode is not modified.
- The accepted pre-feature baseline remains the captured stale Python content-test failures and the active-flow verifier issue; introduce no new failure names.

---

### Task 1: Deterministic Bidirectional Flow Controller

**Files:**
- Modify: `tests/test_flow_interactions.js`
- Modify: `flow-interactions.js`

**Interfaces:**
- Consumes: `documentRef.querySelector`, `documentRef.querySelectorAll`, and the current flow DOM classes `flow-current`/`flow-visited`.
- Produces: `advance(boxId)`, `retreat(boxId)`, `advanceActiveUntilComplete()`, `retreatActiveUntilStart()`, `reset(boxId)`, `resetActive()`, `startAt(boxId, nodeId)`, `bindGlobalPointer(target)`, `getState(boxId)`, and `destroy()`.
- State shape: immutable `{ index: number, currentId: string | null }` per flow box.
- Step shape: immutable `{ id: string, resumeFrom?: string, resumeVia?: readonly string[] }`.

- [ ] **Step 1: Replace timer-oriented expectations with failing playback and reverse-navigation tests**

Update the exact playback expectation in `tests/test_flow_interactions.js` to:

```js
const expected = {
  fbox1: [
    'st', 'n1', 'n2', 'no', 'end1',
    ['yes', 'n2'], 'n3', 'nc', 'f1', 'n5', 'n6', 'n7', 'n7n', 'end2',
    ['n7n', 'n7'], 'n5', 'n6', 'n7', 'n8', 'c2',
    ['oc', 'n3'], 'f2', 'n8', 'c2',
  ],
  fbox2: [
    'c1', 'n9', 'b1', 'b2', 'b2n', 'b3',
    ['b4', 'b2', ['b3']], 'b5', 'b6', 'b6n', 'b4', 'b5', 'b6', 'c3',
  ],
  fbox3: [
    'c2b', 'w1', 'w2', 'w3', 'w4', 'c1b', ['a1', 'w4'],
    'a2', 'a3', 'pay', 'fin',
  ],
};
const normalize = (step) => {
  if (!step.resumeFrom) return step.id;
  return step.resumeVia
    ? [step.id, step.resumeFrom, [...step.resumeVia]]
    : [step.id, step.resumeFrom];
};
```

Remove tests that run fake auto-return timers. Add focused tests with these assertions:

```js
test('waits at endpoints until forward input resumes the alternate branch', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox1', 5);
  assert.equal(controller.getState('fbox1').currentId, 'end1');
  controller.advance('fbox1');
  assert.equal(controller.getState('fbox1').currentId, 'yes');
  assert.equal(node(documentRef, 'fbox1', 'no').classList.contains('flow-visited'), false);
  assert.equal(node(documentRef, 'fbox1', 'end1').classList.contains('flow-visited'), false);
});

test('follows the approved quote-objection loop and reverses it exactly', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox1', 14);
  assert.equal(controller.getState('fbox1').currentId, 'end2');
  controller.advance('fbox1');
  assert.equal(controller.getState('fbox1').currentId, 'n7n');
  for (const expectedId of ['n5', 'n6', 'n7', 'n8']) {
    assert.equal(controller.advance('fbox1').id, expectedId);
  }
  for (const expectedId of ['n7', 'n6', 'n5', 'n7n', 'end2']) {
    assert.equal(controller.retreat('fbox1').id, expectedId);
  }
  assert.equal(node(documentRef, 'fbox1', 'end2').classList.contains('flow-current'), true);
});

test('page 14 clears the shortage branch and visibly advances from b3 to b4', () => {
  const { controller, documentRef } = createFixture();
  advanceTimes(controller, 'fbox2', 6);
  assert.equal(controller.getState('fbox2').currentId, 'b3');
  assert.equal(controller.advance('fbox2').id, 'b4');
  assert.equal(node(documentRef, 'fbox2', 'b2n').classList.contains('flow-visited'), false);
  assert.equal(node(documentRef, 'fbox2', 'b3').classList.contains('flow-visited'), true);
});

test('reports flow boundaries without restarting or changing state', () => {
  const { controller, documentRef } = createFixture();
  documentRef.setActiveSlide('s9');
  advanceTimes(controller, 'fbox3', FLOW_PLAYBACK.fbox3.length);
  const finalState = controller.getState('fbox3');
  assert.equal(controller.advanceActiveUntilComplete().status, 'complete');
  assert.deepEqual(controller.getState('fbox3'), finalState);
  controller.reset('fbox3');
  assert.equal(controller.retreatActiveUntilStart().status, 'start-boundary');
  controller.advance('fbox3');
  assert.equal(controller.retreatActiveUntilStart().status, 'start-boundary');
});
```

- [ ] **Step 2: Run the Node suite and prove RED**

Run:

```bash
node --test tests/test_flow_interactions.js
```

Expected: FAIL because the current playback still contains `autoReturn`, `retreat`/`retreatActiveUntilStart`/`resetActive` do not exist, and timer-driven tests no longer match the contract.

- [ ] **Step 3: Implement immutable resume metadata and deterministic class rendering**

Replace `freezeSteps` and `FLOW_PLAYBACK` in `flow-interactions.js` with the approved tables. Deep-freeze `resumeVia`:

```js
const freezeSteps = (steps) => Object.freeze(steps.map((step) => {
  const normalized = typeof step === 'string' ? { id: step } : { ...step };
  if (normalized.resumeVia) normalized.resumeVia = Object.freeze([...normalized.resumeVia]);
  return Object.freeze(normalized);
}));
```

Replace timer-based class mutation with deterministic rendering:

```js
function visiblePathAt(boxId, index) {
  const visiblePath = [];
  FLOW_PLAYBACK[boxId].slice(0, index + 1).forEach((step) => {
    if (step.resumeFrom) {
      const resumeIndex = visiblePath.lastIndexOf(step.resumeFrom);
      visiblePath.splice(resumeIndex + 1);
      (step.resumeVia || []).forEach((nodeId) => visiblePath.push(nodeId));
    }
    visiblePath.push(step.id);
  });
  return visiblePath;
}

function renderAtIndex(boxId, index) {
  clearClasses(boxId);
  const visiblePath = visiblePathAt(boxId, index);
  const currentId = visiblePath.at(-1) || null;
  new Set(visiblePath.slice(0, -1)).forEach((nodeId) => {
    findNode(boxId, nodeId)?.classList.add('flow-visited');
  });
  const currentNode = findNode(boxId, currentId);
  currentNode?.classList.remove('flow-visited');
  currentNode?.classList.add('flow-current');
  return replaceState(boxId, { index, currentId });
}
```

Implement forward, backward, and active helpers without timers:

```js
function advance(boxId) {
  const steps = FLOW_PLAYBACK[boxId];
  if (!steps) return { status: 'inactive' };
  const state = states[boxId];
  if (state.index >= steps.length - 1) {
    return { status: 'complete', boxId, id: state.currentId };
  }
  const nextState = renderAtIndex(boxId, state.index + 1);
  return { status: 'advanced', boxId, id: nextState.currentId };
}

function retreat(boxId) {
  const steps = FLOW_PLAYBACK[boxId];
  if (!steps) return { status: 'inactive' };
  const state = states[boxId];
  if (state.index <= 0) {
    return { status: 'start-boundary', boxId, id: state.currentId };
  }
  const nextState = renderAtIndex(boxId, state.index - 1);
  return { status: 'retreated', boxId, id: nextState.currentId };
}

function activeBoxId() {
  const activeSlide = documentRef?.querySelector('.slide.active');
  return activeSlide && FLOW_BY_SLIDE[activeSlide.id];
}

function advanceActiveUntilComplete() {
  const boxId = activeBoxId();
  return boxId ? advance(boxId) : { status: 'inactive' };
}

function retreatActiveUntilStart() {
  const boxId = activeBoxId();
  return boxId ? retreat(boxId) : { status: 'inactive' };
}

function resetActive() {
  const boxId = activeBoxId();
  return boxId ? reset(boxId) : { status: 'inactive' };
}
```

Keep global pointer routing and direct node selection, but make a completed background pointer stay complete instead of restarting. Remove `AUTO_RETURN_MS`, timer options, `locked`, `timerId`, timer cleanup, scheduling, and automatic-return functions.

- [ ] **Step 4: Run the controller tests and syntax check**

Run:

```bash
node --test tests/test_flow_interactions.js
node --check flow-interactions.js
```

Expected: all controller tests pass; syntax check exits 0 with no output.

- [ ] **Step 5: Review Task 1 and commit only controller files**

Run:

```bash
git diff --check -- flow-interactions.js tests/test_flow_interactions.js
git diff -- flow-interactions.js tests/test_flow_interactions.js
git add flow-interactions.js tests/test_flow_interactions.js
git commit -m "feat: add bidirectional flow playback"
```

Expected: the commit contains no `webpresent.html` changes.

---

### Task 2: Presentation Buttons, Projector Keys, and Reset Boundaries

**Files:**
- Modify: `tests/test_webpresent.py`
- Modify: `webpresent.html`

**Interfaces:**
- Consumes: Task 1 controller methods `advanceActiveUntilComplete()`, `retreatActiveUntilStart()`, and `resetActive()`.
- Produces: inline `advancePresentation()`, `retreatPresentation()`, and reset-aware `go(i)` presentation actions.

- [ ] **Step 1: Back up and fingerprint the user-edited HTML baseline**

Run:

```bash
mkdir -p .superpowers/sdd
git diff -- webpresent.html > .superpowers/sdd/user-webpresent-before-bidirectional-navigation.patch
shasum -a 256 webpresent.html > .superpowers/sdd/user-webpresent-before-bidirectional-navigation.sha256
```

Expected: both ignored evidence files exist, and `git status --short` still shows only the user's `webpresent.html` modification before source tests are edited.

- [ ] **Step 2: Write failing source-integration assertions**

Replace navigation expectations in `test_mouse_and_presentation_pen_navigation_preserve_flow_slides` with:

```python
self.assertIn("function advancePresentation()", normalized)
self.assertIn("window.dioFlowController?.advanceActiveUntilComplete()", normalized)
self.assertIn("result.status === 'complete'", normalized)
self.assertIn("function retreatPresentation()", normalized)
self.assertIn("window.dioFlowController?.retreatActiveUntilStart()", normalized)
self.assertIn("result.status === 'start-boundary'", normalized)
self.assertIn("window.dioFlowController?.resetActive()", normalized)
self.assertIn("document.getElementById('btnNext').onclick = () => go(cur + 1)", normalized)
self.assertIn("document.getElementById('btnPrev').onclick = () => go(cur - 1)", normalized)
self.assertIn("advancePresentation();", normalized)
self.assertIn("retreatPresentation();", normalized)
```

Add a preservation test:

```python
def test_preserves_user_updated_flowchart_wording(self):
    for wording in ["產能充足？", "新舊案?", "報價異議", "舊案沿用歷史價格"]:
        self.assertIn(wording, self.source)
```

- [ ] **Step 3: Run the focused Python tests and prove RED**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  tests.test_webpresent.WebpresentContentTest.test_mouse_and_presentation_pen_navigation_preserve_flow_slides \
  tests.test_webpresent.WebpresentContentTest.test_preserves_user_updated_flowchart_wording
```

Expected: the wording test passes and navigation test fails because `retreatPresentation` is absent and the on-screen buttons still use the old flow-first wiring.

- [ ] **Step 4: Make slide changes reset the departing active flow**

Update `go(i)` without changing slide layout:

```js
function go(i) {
  const next = Math.max(0, Math.min(slides.length - 1, i));
  if (next !== cur) window.dioFlowController?.resetActive();
  cur = next;
  slides.forEach((s, k) => s.classList.toggle('active', k === cur));
  document.getElementById('progress').style.width = ((cur + 1) / slides.length * 100) + '%';
}
```

- [ ] **Step 5: Wire flow-aware projector actions and direct slide buttons**

Use shared keyboard actions:

```js
function advancePresentation() {
  const result = window.dioFlowController?.advanceActiveUntilComplete();
  if (!result || result.status === 'inactive' || result.status === 'complete') go(cur + 1);
}

function retreatPresentation() {
  const result = window.dioFlowController?.retreatActiveUntilStart();
  if (!result || result.status === 'inactive' || result.status === 'start-boundary') go(cur - 1);
}
```

Wire buttons and key families exactly:

```js
document.getElementById('btnNext').onclick = () => go(cur + 1);
document.getElementById('btnPrev').onclick = () => go(cur - 1);

if (nextKeys.includes(e.key)) {
  e.preventDefault();
  advancePresentation();
  return;
}
if (previousKeys.includes(e.key)) {
  e.preventDefault();
  retreatPresentation();
  return;
}
```

Do not edit active `buildDio` definitions or the user's wording changes.

- [ ] **Step 6: Run source integration, controller, and flowchart checks**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  tests.test_webpresent.WebpresentContentTest.test_mouse_and_presentation_pen_navigation_preserve_flow_slides \
  tests.test_webpresent.WebpresentContentTest.test_preserves_user_updated_flowchart_wording
node --test tests/test_flow_interactions.js
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
```

Expected: both focused Python tests pass; all Node tests pass; the flowchart verifier introduces no new failure beyond the captured baseline.

- [ ] **Step 7: Run browser behavior and viewport verification before commit**

Create an ignored `.superpowers/sdd/bidirectional-flow-browser-check.mjs` using the installed Playwright runtime. It must:

```js
const flowSlides = [
  { slideId: 's7', boxId: 'fbox1', nextSlideId: 's8' },
  { slideId: 's8', boxId: 'fbox2', nextSlideId: 's9' },
  { slideId: 's9', boxId: 'fbox3', nextSlideId: 's17' },
];
const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
const previousKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
```

For each flow and key family, assert one input causes exactly one state or slide transition. Traverse Page 13 and assert the sequence around the objection loop is exactly:

```js
['n7', 'n7n', 'end2', 'n7n', 'n5', 'n6', 'n7', 'n8']
```

Assert `btnNext`/`btnPrev` change slides immediately and reset the departed flow. Assert a forward input after the final entry changes slides and leaves the old flow at index `-1`; assert backward at index `0` or `-1` does the same toward the previous slide.

At `1920x1080`, `1280x720`, `768x1024`, `375x667`, and `667x375`, assert every flow SVG renders, the controller loads, document width does not exceed the viewport, no flow element crosses the viewport, and no `pageerror` occurs. Capture settled `1600x900` screenshots for visual inspection.

Run through a loopback-only server and stop both browser and server afterward. Expected: all behavior and geometry checks pass, with zero local runtime/resource errors.

- [ ] **Step 8: Review Task 2 and commit presentation integration**

Run:

```bash
git diff --check -- webpresent.html tests/test_webpresent.py
git diff -- webpresent.html tests/test_webpresent.py
git add webpresent.html tests/test_webpresent.py
git commit -m "feat: add bidirectional projector flow navigation"
```

Expected: the committed HTML contains all user wording edits plus only the approved navigation changes; active `buildDio` geometry remains identical to the pre-implementation fingerprint.

---

### Task 3: Final Integrity and Regression Gate

**Files:**
- Verify: `flow-interactions.js`
- Verify: `webpresent.html`
- Verify: `tests/test_flow_interactions.js`
- Verify: `tests/test_webpresent.py`
- Evidence only: `.superpowers/sdd/`

**Interfaces:**
- Consumes: completed Task 1 controller and Task 2 presentation integration.
- Produces: final test, browser, integrity, and review evidence; no production changes unless a verified defect is found.

- [ ] **Step 1: Run fresh focused verification**

Run:

```bash
node --test tests/test_flow_interactions.js
node --check flow-interactions.js
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  tests.test_webpresent.WebpresentContentTest.test_mouse_and_presentation_pen_navigation_preserve_flow_slides \
  tests.test_webpresent.WebpresentContentTest.test_preserves_user_updated_flowchart_wording
git diff --check 5f94d71..HEAD
```

Expected: all focused tests and checks pass.

- [ ] **Step 2: Compare full-suite failures with the accepted baseline**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests/test_webpresent.py
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
```

Expected: no new failure names beyond the previously captured stale Python content tests and flow verifier baseline. Record exact names and counts in `.superpowers/sdd/bidirectional-final-evidence.json`.

- [ ] **Step 3: Run structural integrity checks**

Assert and record:

```text
24 slide sections
24 unique slide IDs
0 missing local resources
active buildDio node/edge geometry unchanged from the user-edited baseline
all preserved wording present
browser behavior failures: 0
browser viewport overflow failures: 0
```

- [ ] **Step 4: Review the complete branch**

Review `5f94d71..HEAD` for correctness, boundary behavior, double event handling, user-edit preservation, active-flow scope, and missing tests. Fix every Critical or Important finding with a focused failing test, rerun affected verification, and request re-review until the branch is ready.

- [ ] **Step 5: Confirm clean completion state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected: no uncommitted tracked production/test changes, no running browser/server processes, and the feature branch contains the reviewed implementation commits.
