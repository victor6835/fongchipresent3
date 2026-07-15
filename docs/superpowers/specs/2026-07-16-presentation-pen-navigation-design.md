# Presentation Pen Navigation Design

Date: 2026-07-16

## Goal

Make the HTML deck behave like a conventional presentation for mouse and presentation-pen input while preserving the Page13-15 flowchart step animation.

## Approved Interaction Contract

### Ordinary slides

- A primary click anywhere on the active slide advances one page.
- Clicks originating from an interactive element do not trigger slide navigation.
- Interactive exclusions include buttons, links, form controls, `[data-go]` elements, and their descendants.
- The final slide remains on the final slide because the existing `go()` function clamps the index.

### Flowchart slides

- Slides mapped by `FongchiFlowInteractions.FLOW_BY_SLIDE` remain flow-interaction pages.
- A primary click on Page13-15 continues to advance or target flow nodes through `dioFlowController`.
- The ordinary-slide click-to-next handler must return without changing pages on these slides.
- Existing reset buttons and node targeting remain unchanged.

### Presentation-pen keys

- Next page: `ArrowRight`, `ArrowDown`, `PageDown`, Space, and `Enter`.
- Previous page: `ArrowLeft`, `ArrowUp`, `PageUp`, and `Backspace`.
- Keyboard events originating from buttons, links, form controls, or `[data-go]` elements remain reserved for those controls. This includes `.flowReset`.
- Handled navigation keys call `preventDefault()` to avoid browser scrolling or history navigation.

## Implementation Shape

- Keep navigation inside the existing inline presentation controller in `webpresent.html`.
- Add one small helper that identifies interactive pointer or keyboard targets.
- Add one click listener to `#stage`. It checks the current slide, ignores non-primary clicks, flow slides, and interactive targets, then calls `go(cur + 1)`.
- Expand the existing key groups rather than adding a second keyboard listener.
- Do not modify `flow-interactions.js`, flow playback tables, `buildDio` nodes/edges, page numbers, reset controls, or visual layout.

## Testing

- Add a failing source/integration test before implementation.
- Assert the exact next/previous key groups, `preventDefault()` behavior, interactive-target guard, and flow-slide guard.
- Run the existing Python, interaction, and flowchart verifier suites.
- In Chrome, verify an ordinary-slide body click advances once, an interactive control does not double-advance, Page13-15 clicks stay on the same slide while advancing flow state, and the new forward/backward keys navigate correctly.
- Recheck all five established viewports for layout regressions; no visual change is expected.

## Success Criteria

- Ordinary slides advance exactly one page per primary click.
- Page13-15 retain their current flowchart behavior without accidental page navigation.
- Common presentation-pen keyboard outputs can move both forward and backward.
- Existing navigation buttons, reset buttons, flow animation, and flow data remain unchanged.
