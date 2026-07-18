# Bidirectional Flow Navigation Design

Date: 2026-07-18

## Goal

Make Pages 13-15 behave predictably with both on-screen navigation and projector controls. On-screen previous/next buttons always change slides. Projector previous/next inputs traverse flow nodes in both directions, change slides only at a flow boundary, and reset the departed flow.

## Preserved User Edits

The existing uncommitted edits in `webpresent.html` are the source version for implementation. Preserve all of them, including the visible wording changes for `產能充足？`, `新舊案?`, `報價異議`, and `舊案沿用歷史價格`. Do not restore or overwrite those edits.

Only the active `buildDio('fbox1'..'fbox3')` definitions render Pages 13-15. The navigation change must not alter active node geometry, edges, routes, labels, or CSS.

## Input Contract

### On-screen buttons

- `btnPrev` always changes to the previous slide.
- `btnNext` always changes to the next slide.
- This direct slide behavior also applies on flow slides.
- Leaving a flow slide through either button resets that flow before the slide changes.

### Projector and keyboard controls

Forward inputs are `ArrowRight`, `ArrowDown`, `PageDown`, Space, and `Enter`.

Backward inputs are `ArrowLeft`, `ArrowUp`, `PageUp`, and `Backspace`.

On ordinary slides, these inputs change slides directly. On flow slides:

- A forward input advances exactly one playback entry.
- A backward input returns exactly one playback entry.
- If the final playback entry is already active, the next forward input resets the flow and changes to the next slide.
- If the flow is unstarted or the first playback entry is active, a backward input resets the flow and changes to the previous slide.
- Every slide transition resets the flow being departed, including buttons, keyboard boundaries, table-of-contents links, Home/End, and hash navigation.

### Existing pointer interactions

- Flow nodes remain directly selectable.
- Flow-background pointer input continues to advance the active flow without changing slides.
- Presentation navigation buttons remain excluded from the global flow pointer handler so one click cannot trigger both a flow step and a slide change.
- Pointer input at a completed flow remains on the completed node; only a presentation forward input changes the slide.

## Playback Model

Replace timed `autoReturn` endpoints with explicit user-driven resume metadata on the step entered after an endpoint:

```js
{ id: 'nextNode', resumeFrom: 'decisionNode', resumeVia: ['optionalSharedNode'] }
```

- `resumeFrom` identifies the branch decision whose alternate path is being resumed.
- Before entering the step, nodes after `resumeFrom` on the abandoned branch are removed from the visible path.
- `resumeVia` optionally retains shared merge nodes as visited before the new current node.
- There are no timers, locked states, or automatic returns.

The controller renders node classes deterministically from playback index zero through the current index. It builds a visible path, applies each resume transition, marks all path entries except the last as `flow-visited`, and marks the last as `flow-current`. Re-rendering from the index makes forward and backward navigation exact even when node IDs appear more than once.

## Exact Playback Changes

### Page 13: `s7/fbox1`

The first rejected branch becomes:

```text
n2 -> no -> end1 -> [next input] yes -> n3
```

Entering `yes` resumes from `n2`, so `no` and `end1` are cleared only when the user presses forward again.

The quote-objection route becomes:

```text
n7 -> n7n -> end2 -> [next input] n7n -> n5 -> n6 -> n7 -> n8
```

Entering the second `n7n` resumes from `n7`. This implements the approved route:

```text
客戶確認 -> N -> 報價異議 -> 結束
報價異議 -> 接洽報價 -> 正式報價 -> 客戶確認 -> Y -> 溝通與整理檔案
```

It must not return to `客戶確認` immediately after `end2`.

After the first `c2`, the next input enters `oc` while resuming from `n3`, then follows `oc -> f2 -> n8 -> c2`. The second `c2` is the final playback entry.

### Page 14: `s8/fbox2`

The shortage route is:

```text
b2 -> b2n -> b3 -> [next input] b4
```

Entering `b4` resumes from `b2` and retains shared merge node `b3` as visited. This clears the N-only `b2n` branch and advances visibly to `印製輸出`, avoiding a no-op second `b3` step.

The existing rework route `b6 -> b6n -> b4 -> b5 -> b6 -> c3` remains unchanged.

### Page 15: `s9/fbox3`

The failed-acceptance connector route is:

```text
w4 -> c1b -> [next input] a1
```

Entering `a1` resumes from `w4`, clears `c1b`, and continues through the Y route. `fin` remains the final playback entry.

## Controller API

The flow controller owns playback state and class rendering:

- `advance(boxId)` advances one entry or returns `complete` without restarting.
- `retreat(boxId)` moves back one entry or returns `start-boundary`.
- `advanceActiveUntilComplete()` resolves the active flow and delegates forward movement.
- `retreatActiveUntilStart()` resolves the active flow and delegates backward movement.
- `reset(boxId)` clears the flow explicitly.
- `resetActive()` resets the active flow when the presentation leaves a slide.

Unknown flow boxes and ordinary slides return `inactive`. Invalid node selections return `inactive` and do not change state.

## Presentation Controller

Centralize slide changes in `go(i)`. When `i` differs from the current slide index, `go` resets the active departing flow before activating the target slide. This guarantees consistent reset behavior for buttons and every other navigation path.

Use two keyboard actions:

- Forward: on a flow slide, advance one entry; on `complete`, call `go(cur + 1)`; on an ordinary slide, call `go(cur + 1)` immediately.
- Backward: on a flow slide, retreat one entry; on `start-boundary`, call `go(cur - 1)`; on an ordinary slide, call `go(cur - 1)` immediately.

`btnPrev` and `btnNext` call `go(cur - 1)` and `go(cur + 1)` directly and never invoke flow stepping.

## Testing

Follow TDD and prove RED before implementation.

### Unit tests

- Assert the exact timer-free playback tables and resume metadata.
- Assert deterministic rendering across each resume boundary.
- Assert backward navigation reconstructs the immediately previous state, including abandoned branch paths.
- Assert Page 13 follows `end2 -> n7n -> n5 -> n6 -> n7 -> n8`.
- Assert Page 14 advances from shortage-route `b3` directly to `b4` while retaining `b3` as visited and clearing `b2n`.
- Assert Page 15 waits at `c1b` until the next input enters `a1`.
- Assert final forward returns `complete` without restarting and first/unstarted backward returns `start-boundary`.
- Assert reset and direct node selection remain correct.

### Source integration tests

- Assert `btnPrev` and `btnNext` call direct slide navigation.
- Assert forward and backward key families call their respective shared actions.
- Assert slide changes reset the active departing flow.
- Assert all preserved user wording remains present.

### Browser tests

- Exercise all five forward and four backward inputs on Pages 13-15.
- Traverse each flow forward and backward across every resume boundary.
- Verify the Page 13 approved route node by node.
- Verify buttons bypass flow stepping, change slides once, and reset the departed flow.
- Verify final-forward and first/unstarted-backward slide boundaries reset the flow.
- Check all three flow slides at `1920x1080`, `1280x720`, `768x1024`, `375x667`, and `667x375` with no page errors, overlap, clipping, or overflow.

## Integrity Gate

- The presentation retains 24 unique slide sections.
- Every local image and script resource exists.
- Active `buildDio` node and edge definitions remain unchanged from the user-edited pre-implementation baseline.
- The flowchart verifier has no new failures beyond any explicitly captured pre-existing baseline.
- Focused Node, Python source-integration, browser, syntax, and whitespace checks pass.

## Success Criteria

- Every input causes at most one node transition or one slide transition.
- On-screen navigation always changes slides, including on flow pages.
- Projector controls traverse flow nodes in both directions.
- No endpoint changes automatically with time.
- Branch cleanup occurs only on the next user input.
- Page 13 follows the approved quote-objection loop exactly.
- Leaving any flow slide resets its playback state.
- All user content edits present before implementation are preserved.
