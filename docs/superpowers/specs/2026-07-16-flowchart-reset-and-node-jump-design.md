# Flowchart Reset And Node Jump Design

## Goal

Extend the Page13-15 flowchart interaction without changing any flow node, edge, label, lane, row, or route data. Users can reset a flow, start playback from a clicked node, and see completed branch nodes return to their original colors when the flow automatically returns to a decision.

## Scope

- Applies only to Page13 `#fbox1`, Page14 `#fbox2`, and Page15 `#fbox3`.
- Preserves the existing playback order, N-first routing, Page13 new-customer-before-old-customer sequence, 700ms endpoint delay, independent page state, pulse/glow styling, and completion restart behavior.
- Does not modify the legacy `FLOWS`, `buildDrawio1`, play/reset controls, active `buildDio` node/edge data, navigation order, or page numbers.

## Reset Control

Each flowchart slide receives one real button immediately to the left of its bottom-right page number:

```text
↺ 回到起始    13 / 24
```

The button:

- exists only on slides `s7`, `s8`, and `s9`;
- uses `type="button"`, class `flowReset`, and `data-flow-reset="fboxN"`;
- remains visible and non-overlapping at all required viewports;
- cancels any pending automatic-return timer for that page;
- removes `flow-current` and `flow-visited` from every node on that page;
- leaves the controller at index `-1` with no current node, so every node shows its original color;
- allows the next ordinary left click to activate the first playback node.

The reset-button pointer event must never also advance the flow. Keyboard activation must perform the same reset.

## Start From A Clicked Node

A left pointer press on a rendered active `.dio[data-node-id]` node starts playback from that node.

The controller will:

1. resolve the active slide to its flow box;
2. ignore nodes outside that active flow box;
3. cancel that page's pending timer;
4. remove all current and visited classes on that page;
5. choose the first occurrence of the clicked node ID in `FLOW_PLAYBACK[boxId]`;
6. set that occurrence as the current index and add `flow-current` to the clicked node;
7. return without performing the ordinary one-step advance.

The next ordinary left click continues from the following playback step. If the selected first occurrence is an automatic-return endpoint, its existing 700ms return behavior begins immediately; pointer presses remain locked until that return completes.

Unknown node IDs or node targets outside the active flow return an inactive result and do not change state.

## Decision Return Cleanup

When an automatic endpoint returns to a decision node, every node traversed after that decision in the current branch must return to its original styling.

For an automatic endpoint at playback index `endpointIndex` with `autoReturn: decisionId`:

1. Find the nearest preceding playback index whose node ID equals `decisionId`.
2. Remove `flow-current` and `flow-visited` from every unique node ID between `decisionIndex + 1` and `endpointIndex`, inclusive.
3. Remove `flow-visited` from the decision node and add `flow-current` to it.
4. Keep the playback index at the endpoint index so the next click continues with the existing approved sequence.
5. Unlock the page and clear its timer ID.

Expected cleanup segments include:

- Page13 `end1 -> n2`: clear `no`, `end1`.
- Page13 `end2 -> n7`: clear `n7n`, `end2`.
- Page13 first `c2 -> n3`: clear the complete traversed new-customer segment after `n3`.
- Page14 first `b3 -> b2`: clear `b2n`, `b3`.
- Page15 `c1b -> w4`: clear `c1b`.

Nodes before the returned decision retain their current visited/original state.

## Event Priority

The capture-phase global `pointerdown` handler processes a left click in this order:

1. Reset button: reset the named active flow and stop processing.
2. Active flow node: call `startAt(boxId, nodeId)` and stop processing.
3. Any other location: call the existing `advanceActive()` behavior.

Right-button and other non-left pointer events remain ignored.

## Controller API

`createFlowInteractionController()` adds:

```text
startAt(boxId, nodeId)
```

The existing `reset(boxId)` behavior remains the source of truth for restoring all original colors. The returned controller API becomes:

```text
advance, advanceActive, startAt, bindGlobalPointer, reset, getState, destroy
```

All controller state updates remain immutable object replacements.

## Testing

### Unit Tests

- Reset during ordinary playback clears all classes and leaves index `-1`.
- Reset during a locked endpoint cancels its timer and prevents a stale return.
- `startAt` clears earlier state, selects the first duplicate occurrence, and makes only the selected node current.
- Selecting an automatic endpoint starts and locks its return timer.
- Clicking a child shape/text resolves its ancestor `data-node-id` node.
- Node and reset pointer events do not also advance.
- Ordinary background pointer events still advance one step.
- Every automatic return clears only the approved post-decision segment.
- Per-page state remains independent.

### Source And Integration Tests

- Exactly three reset buttons are created from `FLOW_BY_SLIDE`.
- Buttons carry the correct box IDs and reset handler.
- CSS places each reset control beside the page number without changing `.pgno` position.
- Active `buildDio` remains the only renderer receiving `data-node-id`.

### Browser QA

- Exercise reset, node jump, duplicate-node selection, locked-timer cancellation, and branch cleanup in real Chrome.
- Confirm reset and node clicks produce one action only.
- Verify original/current/visited computed styles and unchanged node `getBBox()` values.
- Capture Page13 at `1920x1080`, `1280x720`, `768x1024`, `375x667`, and `667x375` with the new control visible and non-overlapping.
- Reconfirm all three parsed-flow hashes match their pre-feature baselines.
