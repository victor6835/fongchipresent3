# Presentation Pen Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conventional click-to-next and presentation-pen key navigation without changing Page13-15 flowchart click behavior.

**Architecture:** Extend only the existing inline presentation controller in `webpresent.html`. A shared interactive-target guard protects controls, a single `#stage` click listener advances ordinary slides, and the existing keydown listener receives the expanded forward/backward key sets. Flow slides are identified through `FongchiFlowInteractions.FLOW_BY_SLIDE` and remain owned by `dioFlowController`.

**Tech Stack:** Zero-dependency HTML/CSS/JavaScript, Python `unittest` source integration tests, Node flow-controller tests, active-flow verifier, headless Chrome CDP.

## Global Constraints

- Ordinary slides advance exactly one page per primary click.
- Page13-15 clicks remain flow-animation input and must not navigate the slide.
- Interactive targets must not trigger global pointer or keyboard navigation.
- Next keys are exactly `ArrowRight`, `ArrowDown`, `PageDown`, Space, and `Enter`.
- Previous keys are exactly `ArrowLeft`, `ArrowUp`, `PageUp`, and `Backspace`.
- Do not modify `flow-interactions.js`, flow playback tables, active `buildDio` nodes/edges, reset controls, page numbers, or visual layout.
- This workspace has no Git repository; record test evidence instead of commits.

---

### Task 1: Implement guarded mouse and presentation-pen navigation with TDD

**Files:**
- Modify: `tests/test_webpresent.py`
- Modify: `webpresent.html` navigation controller only
- Create: `.superpowers/sdd/pen-navigation-task-1-report.md`

**Interfaces:**
- Consumes: existing `slides`, `cur`, `go(index)`, `#stage`, and `window.FongchiFlowInteractions.FLOW_BY_SLIDE`.
- Produces: `isInteractiveNavigationTarget(target): boolean`, ordinary-slide click-to-next behavior, and expanded key mappings.

- [ ] **Step 1: Add the failing integration test**

Add this method to `WebpresentContentTest` in `tests/test_webpresent.py`:

```python
def test_mouse_and_presentation_pen_navigation_preserve_flow_slides(self):
    normalized = re.sub(r"\s+", " ", self.source)

    self.assertIn(
        "const interactiveNavigationSelector = "
        "'button, a, input, select, textarea, [data-go]'",
        normalized,
    )
    self.assertIn(
        "const isInteractiveNavigationTarget = target => "
        "target?.closest?.(interactiveNavigationSelector)",
        normalized,
    )
    self.assertIn("document.getElementById('stage').addEventListener('click', e =>", normalized)
    self.assertIn("if (e.button !== 0 || isInteractiveNavigationTarget(e.target)) return", normalized)
    self.assertIn(
        "if (window.FongchiFlowInteractions?.FLOW_BY_SLIDE[slides[cur].id]) return",
        normalized,
    )
    self.assertIn("go(cur + 1)", normalized)

    self.assertIn(
        "const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']",
        normalized,
    )
    self.assertIn(
        "const previousKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']",
        normalized,
    )
    self.assertIn("if (isInteractiveNavigationTarget(e.target)) return", normalized)
    self.assertIn("if (nextKeys.includes(e.key))", normalized)
    self.assertIn("if (previousKeys.includes(e.key))", normalized)
    self.assertGreaterEqual(normalized.count("e.preventDefault()"), 2)
    self.assertIn("if (e.key === 'Home') go(0)", normalized)
    self.assertIn("if (e.key === 'End') go(slides.length - 1)", normalized)
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_mouse_and_presentation_pen_navigation_preserve_flow_slides
```

Expected: FAIL because `interactiveNavigationSelector` and the stage click listener do not yet exist.

- [ ] **Step 3: Add the shared interactive-target guard and ordinary-slide click listener**

Immediately after the existing `go(i)` function in `webpresent.html`, add:

```js
const interactiveNavigationSelector = 'button, a, input, select, textarea, [data-go]';
const isInteractiveNavigationTarget = target => target?.closest?.(interactiveNavigationSelector);

document.getElementById('stage').addEventListener('click', e => {
  if (e.button !== 0 || isInteractiveNavigationTarget(e.target)) return;
  if (window.FongchiFlowInteractions?.FLOW_BY_SLIDE[slides[cur].id]) return;
  go(cur + 1);
});
```

This listener runs on `click`, after the normal pointer sequence. It never navigates flow slides, so Page13-15 remain controlled by the capture-phase `pointerdown` flow controller.

- [ ] **Step 4: Replace the existing keydown body with guarded key groups**

Replace only the current global keydown listener with:

```js
addEventListener('keydown', e => {
  if (isInteractiveNavigationTarget(e.target)) return;
  const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
  const previousKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
  if (nextKeys.includes(e.key)) {
    e.preventDefault();
    go(cur + 1);
    return;
  }
  if (previousKeys.includes(e.key)) {
    e.preventDefault();
    go(cur - 1);
    return;
  }
  if (e.key === 'Home') go(0);
  if (e.key === 'End') go(slides.length - 1);
});
```

The shared guard subsumes the prior `.flowReset`-only guard because `.flowReset` is a button.

- [ ] **Step 5: Run focused and complete source regressions**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests.test_webpresent.WebpresentContentTest.test_mouse_and_presentation_pen_navigation_preserve_flow_slides
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
node --test tests/test_flow_interactions.js
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
```

Expected: focused test passes, Python suite has 24 passing tests, interaction suite has 12 passing tests, verifier suite has 10 passing tests, and active flow counts remain `18/19`, `11/12`, and `11/10`.

- [ ] **Step 6: Record Task 1 evidence**

Write `.superpowers/sdd/pen-navigation-task-1-report.md` with the RED failure, GREEN output, exact changed files, and confirmation that active flow data and visual layout were not edited.

---

### Task 2: Verify real presentation behavior and final regressions

**Files:**
- Test: rendered `webpresent.html`
- Create: `.superpowers/sdd/pen-navigation-task-2-report.md`

**Interfaces:**
- Consumes: the Task 1 stage click listener, key groups, existing `go()`, `dioFlowController`, and reset/data-go controls.
- Produces: real-browser evidence for one-step navigation, flow-slide preservation, control guards, key support, and unchanged layout.

- [ ] **Step 1: Start or reuse the loopback preview**

Run:

```bash
/usr/bin/python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/webpresent.html` in a clean headless Chrome/CDP session.

- [ ] **Step 2: Verify ordinary-slide and interactive-click behavior**

At `1600x900`, assert:

```text
Page 1 body primary click -> Page 2 exactly once
Page 2 first [data-go="3"] click -> Page 3 exactly, not Page 4
btnNext click -> one page forward
btnPrev click -> one page backward
Non-primary synthetic click -> no page change
```

- [ ] **Step 3: Verify flow-slide click preservation**

Navigate to Page13, reset `fbox1`, dispatch a complete primary pointer/click sequence on the active slide, and assert:

```text
active slide remains Page13
fbox1 index becomes 0
fbox1 currentId becomes st
exactly one flow-current node exists
```

Click the Page13 reset button and a Page13 node; assert neither click changes the slide and their existing reset/start behaviors still pass.

- [ ] **Step 4: Verify every presentation-pen key and control guard**

For each key, start from a known page and dispatch a cancelable bubbling `KeyboardEvent('keydown')` on `document.body`:

```text
ArrowRight, ArrowDown, PageDown, Space, Enter -> exactly one page forward
ArrowLeft, ArrowUp, PageUp, Backspace -> exactly one page backward
Home -> first page
End -> final page
```

Dispatch Enter and Space from `.flowReset` and from `btnNext`; assert the global key handler does not additionally navigate. Native/programmatic control activation remains one action.

- [ ] **Step 5: Recheck five viewports and browser errors**

Set viewport metrics before navigation for:

```text
1920x1080
1280x720
768x1024
375x667
667x375
```

At each size, assert the active slide remains inside the viewport, no slide overflow or new control overlap appears, and capture a screenshot. Assert zero runtime exceptions and zero meaningful console, log, or local-network errors.

- [ ] **Step 6: Run final source and flow-integrity checks**

Run:

```bash
/Users/zhuangchengfu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest tests/test_webpresent.py
node --test tests/test_flow_interactions.js
node --test .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.test.mjs
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html
node --check flow-interactions.js
```

Recompute parsed-flow SHA-256 values and require the unchanged baselines:

```text
fbox1 624b8a03ab044a24cdd6e546efd0a9f3918f26c0f602dd155b6aa6c7114eddec
fbox2 5d84a895f4253692329379b0a30e0af4836beffc5a68288a5e6043e0efb062a7
fbox3 b8f34d59b472d2179d8297b031924f0b4575d28adc6d4157a077da144551b45c
```

- [ ] **Step 7: Record and independently review final evidence**

Write `.superpowers/sdd/pen-navigation-task-2-report.md` with browser states, five viewport screenshots, test counts, flow hashes, and any ignored browser-only startup resource. An independent reviewer must inspect the implementation and tests, then end with:

```text
Spec compliance: PASS
Code quality: APPROVED
```

Resolve and re-review every blocking finding. Stop QA-only Chrome; leave the preview server running for user handoff.
