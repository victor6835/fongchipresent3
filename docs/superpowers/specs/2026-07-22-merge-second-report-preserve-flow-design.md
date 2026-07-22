# Merge 7-22 Second Report While Preserving Flowcharts

## Goal

Replace the presentation's non-flowchart content with the supplied `7-22_fongchipresent第二次報告` version while preserving the current Page 13-15 flowchart implementation and its verified interaction behavior.

## Source And Target

- Target repository: `/Users/zhuangchengfu/Downloads/fongchipresent 2`
- Source presentation: `/Users/zhuangchengfu/Downloads/7-22_fongchipresent第二次報告`
- Working branch: `codex/merge-7-22-report`
- Baseline commit: `f04f177`

The target worktree contains unrelated local changes to `.DS_Store`, `docs/.DS_Store`, `.vscode/settings.json`, and the final newline of `webpresent.html`. These changes must not be reverted or included in task commits unless the resulting `webpresent.html` replacement necessarily supersedes the newline-only difference.

## Chosen Approach

Use the 7-22 `webpresent.html` as the content and layout base, then transplant the protected flowchart module from the current target. This makes the replacement complete and auditable while avoiding a fragile page-by-page reconstruction of the 7-22 report.

The source's `flow-interactions.js` must not be used. It contains the superseded timed auto-return behavior and lacks the approved bidirectional projector navigation.

## Protected Flowchart Module

The following behavior and source definitions are preserved from the current target:

1. The three flow slides identified by `s7`, `s8`, and `s9`, including `fbox1`, `fbox2`, and `fbox3`.
2. The active `buildDio('fbox1'...)`, `buildDio('fbox2'...)`, and `buildDio('fbox3'...)` definitions.
3. The flow renderer and supporting flow-only JavaScript, including the legacy fallback definitions retained by user request.
4. The current `flow-interactions.js` playback tables and immutable controller behavior.
5. Direct previous/next button navigation, projector-key node traversal, reverse traversal, branch continuation, final-node page advance, and automatic reset when leaving a flow page.
6. Flow pointer, direct-node, reset, and pager isolation behavior.
7. Current flow unit tests and source invariants.

The current active flow wording remains authoritative, including `產能充足？`, `新舊案?`, `報價異議`, and `舊案沿用歷史價格`.

## Allowed Flow Adjustment

The 7-22 report has 23 slides and places the three flow slides at presentation pages 11, 12, and 13. The `data-go` values in the flow pager must therefore target those new page numbers:

- Page 11 (`s7`) links to pages 12 and 13.
- Page 12 (`s8`) links to pages 11 and 13.
- Page 13 (`s9`) links to pages 11 and 12.

This is a page-order adaptation, not a flow behavior change.

## Replaced Content

All non-flow presentation content comes from the 7-22 source, including:

- The 23-slide order and all non-flow slide markup.
- The second-report title, chapter wording, footers, quantitative-benefit content, and story slides.
- Non-flow CSS and JavaScript used by the 7-22 content.
- The `index.html` title `風琦有限公司 SAP 導入評估｜第二次報告`.
- The new `img/cash-release.svg` and `img/receivables-risk.svg` resources.

Existing bitmap assets are byte-identical between source and target and do not need replacement. Historical source documentation and generated `tests/__pycache__` files are not presentation content and must not be imported.

## Code Organization

- Normalize edited text files to LF line endings and retain the repository's existing indentation style.
- Keep major presentation and flow sections clearly delimited.
- Do not split the single-file presentation or remove legacy flow definitions during this scoped merge.
- Keep `flow-interactions.js` external and unchanged unless a failing preservation test proves an integration adjustment is required.
- Do not commit `.DS_Store`, `.vscode/settings.json`, browser screenshots, evidence JSON, or Python cache files.

## Error And Integrity Handling

The merge must fail verification if any protected marker is missing, a slide ID is duplicated, a referenced local asset is absent, any flow node or edge invariant changes, or browser execution reports a page/resource error.

The replacement is not complete if the 7-22 report's new story slides or two SVG resources are missing, or if first-report footer/title text remains outside the protected flow content.

## Verification

Verification must include:

1. A pre-change failing assertion for the 7-22 content and protected-flow composition.
2. The existing Node flow controller suite, expected to remain 14/14.
3. Updated Python source/content tests for the second report, 23 unique slides, the protected flow definitions, pager targets, and navigation behavior.
4. The project flowchart verifier against all active `buildDio` definitions.
5. JavaScript syntax checks for `flow-interactions.js` and the inline presentation script.
6. Browser interaction checks covering next/previous buttons, all projector key families, branch endpoints, reverse restoration, final-node page advance, and flow reset.
7. Browser layout checks at `1600x900` and the established desktop/mobile viewport set, with settled screenshots for `s7`, `s8`, and `s9`.
8. Resource checks proving every local `src` and relevant `href` resolves and no page errors occur.
9. Git diff and whitespace checks confirming only intended files are included.

## Acceptance Criteria

- The presentation renders the 7-22 second-report content in its supplied order.
- Page 11-13 retain the current flowchart visuals, wording, routes, and interaction model.
- Flow pagers navigate to the correct new page positions.
- Both new SVG assets render successfully.
- Existing accepted repository test baselines do not gain new failures.
- Unrelated local changes remain untouched and outside task commits.
