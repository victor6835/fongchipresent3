# Flow-First Forward Navigation Design

Date: 2026-07-17

## Goal

Make forward presentation controls advance the Page 13-15 flowcharts one step at a time. The presentation changes slides only after the active flowchart has reached its final step.

## Approved Interaction Contract

### Flowchart slides

- Rendered Page 13, 14, and 15 map to `s7/fbox1`, `s8/fbox2`, and `s9/fbox3`.
- `ArrowRight`, `ArrowDown`, `PageDown`, Space, `Enter`, and the lower-right `btnNext` control share one forward action.
- When the active flowchart has not reached its final playback entry, the forward action advances exactly one flow step and keeps the current slide active.
- When the final playback entry is already active, the next forward action changes to the following slide.
- While an automatic-return endpoint is locked, forward input is consumed without advancing the flow or changing slides.
- Clicking the flowchart background or a flow node keeps its existing flow interaction behavior.

### Ordinary slides

- The shared forward action changes to the next slide immediately.
- Existing stage-click navigation remains unchanged.
- The final slide remains clamped to the final slide.

### Backward navigation

- `ArrowLeft`, `ArrowUp`, `PageUp`, `Backspace`, and `btnPrev` continue to change to the previous slide directly.
- Backward navigation does not reverse flowchart steps.

## Implementation Shape

- Keep the shared presentation-forward decision in the inline navigation controller in `webpresent.html`.
- Add a flow-controller completion query in `flow-interactions.js` so presentation navigation does not duplicate or inspect private state rules.
- Route the existing forward-key handler and `btnNext` through the shared action.
- Prevent the global flow pointer handler from treating the presentation navigation buttons as background flow clicks.
- Preserve all playback tables, SVG nodes, edges, labels, routes, and visual layout.

## State Decisions

The forward action resolves to one of four outcomes:

| Active state | Result |
|---|---|
| Ordinary slide | Change to next slide |
| Flow slide, unlocked and incomplete | Advance exactly one flow step |
| Flow slide, locked for automatic return | Stay on the current slide and step |
| Flow slide, final step active | Change to next slide |

## Testing

- Add failing Node tests for completion detection and navigation-button pointer exclusion before implementation.
- Add a failing source integration assertion that all forward controls use the shared action.
- Run the focused tests in RED, implement the smallest changes, then rerun in GREEN.
- Browser-test all five forward keys and `btnNext` on Pages 13-15.
- Assert every flow stays on its slide through the final step and advances on the following input.
- Assert ordinary slides still advance immediately and backward controls remain unchanged.
- Run the active-flow verifier and inspect settled screenshots at the required presentation viewports.

## Success Criteria

- One forward input produces at most one flow step or one slide transition, never both.
- Pages 13-15 do not change slides before their flow playback reaches the final entry.
- The input after the final entry changes to the next slide.
- Automatic-return locks cannot accidentally trigger slide navigation.
- Existing flow definitions and presentation layout remain intact.
