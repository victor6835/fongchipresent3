# Flow-First Forward Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every forward presentation control advance Page 13-15 flowcharts one step at a time and change slides only on the input after the final step.

**Architecture:** Extend the existing flow interaction controller with an active-flow operation that distinguishes inactive, locked, incomplete, and complete states without exposing state rules to the presentation controller. Route forward keys and `btnNext` through one inline presentation action, and mark navigation buttons so the capture-phase flow pointer handler cannot double-handle their clicks.

**Tech Stack:** Zero-dependency HTML/JavaScript, Node native test runner, Python `unittest`, project flowchart verifier, Playwright browser validation.

## Global Constraints

- Rendered Page 13, 14, and 15 map to `s7/fbox1`, `s8/fbox2`, and `s9/fbox3`.
- Forward inputs are `ArrowRight`, `ArrowDown`, `PageDown`, Space, `Enter`, and `btnNext`.
- The input after the final playback entry changes slides; the input that reveals the final entry does not.
- Locked automatic-return endpoints consume forward input without changing flow or slide state.
- Backward inputs continue to change slides directly.
- Playback tables, active SVG flow definitions, labels, routes, styles, and layout must remain unchanged.
- The accepted pre-change baseline has 10 failures in `tests/test_webpresent.py` because its content assertions predate the current deck, and the active-flow verifier reports the pre-existing unknown `railR` route. This task must add no new failures and must not repair those unrelated baselines.

---

### Task 1: Add the flow-aware forward contract with TDD

**Files:**
- Modify: `tests/test_flow_interactions.js`
- Modify: `tests/test_webpresent.py`
- Modify: `flow-interactions.js`
- Modify: `webpresent.html`

**Interfaces:**
- Consumes: `FLOW_BY_SLIDE`, `FLOW_PLAYBACK`, existing controller state, `advance(boxId)`, `go(index)`, and `cur`.
- Produces: `dioFlowController.advanceActiveUntilComplete(): { status: 'inactive' | 'locked' | 'complete' | 'advanced', ... }` and `advancePresentation(): void`.

- [ ] **Step 1: Add failing controller tests**

Add Node tests that assert:

```js
documentRef.setActiveSlide('s9');
assert.equal(controller.advanceActiveUntilComplete().status, 'advanced');
advanceTimes(controller, 'fbox3', FLOW_PLAYBACK.fbox3.length - 1);
assert.deepEqual(controller.advanceActiveUntilComplete(), {
  status: 'complete', boxId: 'fbox3', id: 'fin',
});
assert.equal(controller.getState('fbox3').currentId, 'fin');
```

Add cases for a normal slide returning `inactive`, an automatic-return endpoint returning `locked`, and a `[data-flow-navigation]` pointer target leaving the flow index unchanged.

- [ ] **Step 2: Add a failing source integration test**

Update the presentation-navigation test to require:

```python
self.assertIn('function advancePresentation()', normalized)
self.assertIn('window.dioFlowController?.advanceActiveUntilComplete()', normalized)
self.assertIn("if (!result || result.status === 'inactive' || result.status === 'complete')", normalized)
self.assertIn('advancePresentation();', normalized)
self.assertIn("document.getElementById('btnNext').onclick = advancePresentation", normalized)
self.assertIn('data-flow-navigation', self.source)
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
node --test --test-name-pattern "active flow forward|navigation controls" tests/test_flow_interactions.js
python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_mouse_and_presentation_pen_navigation_preserve_flow_slides
```

Expected: Node fails because `advanceActiveUntilComplete` does not exist and the navigation pointer is not ignored; Python fails because the shared forward action does not exist.

- [ ] **Step 4: Implement the controller operation**

Add this behavior inside `createFlowInteractionController`:

```js
function advanceActiveUntilComplete() {
  const activeSlide = documentRef?.querySelector('.slide.active');
  const boxId = activeSlide && FLOW_BY_SLIDE[activeSlide.id];
  if (!boxId) return { status: 'inactive' };
  const state = states[boxId];
  if (state.locked) return { status: 'locked', boxId, id: state.currentId };
  if (state.index === FLOW_PLAYBACK[boxId].length - 1) {
    return { status: 'complete', boxId, id: state.currentId };
  }
  return advance(boxId);
}
```

Return it from the controller API. In `bindGlobalPointer`, return early when the active flow slide receives a pointer event from a target matching `[data-flow-navigation]`.

- [ ] **Step 5: Implement the shared presentation action**

Mark both navigation buttons with `data-flow-navigation`. Add:

```js
function advancePresentation() {
  const result = window.dioFlowController?.advanceActiveUntilComplete();
  if (!result || result.status === 'inactive' || result.status === 'complete') {
    go(cur + 1);
  }
}
```

Assign `btnNext.onclick = advancePresentation` and call `advancePresentation()` from the existing forward-key branch. Keep `btnPrev` and all backward-key behavior unchanged.

- [ ] **Step 6: Run focused and complete tests in GREEN**

Run:

```bash
node --test tests/test_flow_interactions.js
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_mouse_and_presentation_pen_navigation_preserve_flow_slides
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests/test_webpresent.py
node --check flow-interactions.js
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
```

Expected: the focused Python navigation test and all Node tests pass, JavaScript parses, and the complete Python/verifier runs reproduce only the accepted 10 stale-content failures and existing unknown `railR` route with no new failures.

---

### Task 2: Verify projector behavior and presentation integrity

**Files:**
- Test: `webpresent.html`
- Review: `flow-interactions.js`, `webpresent.html`, and both modified test files

**Interfaces:**
- Consumes: `advanceActiveUntilComplete()` and `advancePresentation()` from Task 1.
- Produces: browser evidence for all forward inputs, normal-slide navigation, locked endpoints, final-step transition, and unchanged viewport geometry.

- [ ] **Step 1: Run browser interaction checks**

At `1600x900`, parameterize `s7/fbox1`, `s8/fbox2`, and `s9/fbox3`:

```text
First forward key -> flow index 0, same active slide
Input revealing final entry -> final node active, same active slide
Following forward input -> next slide active
Locked endpoint + forward input -> same flow index and same active slide
```

Repeat the first-step assertion across `ArrowRight`, `ArrowDown`, `PageDown`, Space, and `Enter`. Verify `btnNext` produces only one flow step per click and normal slides advance immediately.

- [ ] **Step 2: Run viewport and runtime checks**

Render settled Pages 13-15 at `1920x1080`, `1280x720`, `768x1024`, `375x667`, and `667x375`. Assert no page errors, no missing flow SVGs, no overflow, and no new visual overlap. Capture a settled `1600x900` screenshot for each flow page.

- [ ] **Step 3: Review the scoped diff**

Require that `git diff` contains only the shared navigation behavior, controller contract, regression tests, and plan document. Confirm the active `buildDio('fbox1'..'fbox3')` calls and `FLOW_PLAYBACK` values are byte-for-byte unchanged.

- [ ] **Step 4: Run final verification**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests/test_webpresent.py
node --test tests/test_flow_interactions.js
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
node --check flow-interactions.js
git diff --check
```

Expected: all feature-specific and Node flow tests pass, JavaScript and whitespace checks pass, and the complete Python/verifier runs contain only the accepted baseline failures with no new failure names or messages.
