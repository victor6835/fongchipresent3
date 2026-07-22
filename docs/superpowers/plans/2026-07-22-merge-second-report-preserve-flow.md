# Merge 7-22 Second Report While Preserving Flowcharts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all non-flow presentation content with the supplied 7-22 second report while retaining the current flowchart source and bidirectional interaction model.

**Architecture:** Compose `webpresent.html` from the 7-22 source plus four protected regions from the current target: flow slide markup, navigation controls, flow-aware navigation logic, and the complete flow renderer/init block. Keep `flow-interactions.js` unchanged, add only the two missing SVG assets, and make the static and browser verification suites prove both halves of the composition.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-in test runner, Python `unittest` and `html.parser`, project flowchart verifier, Playwright Chromium.

## Global Constraints

- Work only on branch `codex/merge-7-22-report`, based on baseline commit `f04f177` plus the approved spec commits.
- Source presentation is `/Users/zhuangchengfu/Downloads/7-22_fongchipresent第二次報告`.
- Preserve the current `flow-interactions.js` byte-for-byte with SHA-256 `5cbf2f7384885c5982dd195abfe45688426ad2af83377022023691f40a779729`.
- Preserve the approved flow wording: `產能充足？`, `新舊案?`, `報價異議`, and `舊案沿用歷史價格`.
- Flow pages become presentation pages 10, 11, and 12; only their pager targets may change for the new DOM order.
- Correct the supplied stale Our Team/Thank You table-of-contents targets to pages 22 and 23.
- Do not import source documentation or `tests/__pycache__`.
- Do not stage or commit `.DS_Store`, `docs/.DS_Store`, `.vscode/settings.json`, browser evidence, or screenshots.
- Keep the current inactive legacy flow definitions because the user explicitly requested the original flowchart code.
- Normalize edited HTML, JavaScript, and Python files to LF line endings.

## File Map

- Modify: `webpresent.html` - 7-22 content shell plus protected flow and navigation regions.
- Modify: `index.html` - second-report title from the supplied source.
- Modify: `tests/test_webpresent.py` - 23-page content, integrity, navigation, and preservation contract.
- Create: `img/cash-release.svg` - supplied quantitative-benefit visual.
- Create: `img/receivables-risk.svg` - supplied receivables-risk visual.
- Preserve unchanged: `flow-interactions.js` - approved immutable bidirectional flow controller.
- Preserve unchanged: `tests/test_flow_interactions.js` - 14 flow behavior tests.
- Temporary only: `/tmp/fongchi-merge-second-report.mjs` - deterministic composition script, removed after use.
- Temporary only: `.superpowers/sdd/second-report-browser-check.mjs` and browser artifacts - ignored verification evidence, removed before handoff.

---

### Task 1: Compose The Second Report Under A Static Test Contract

**Files:**
- Modify: `tests/test_webpresent.py`
- Modify: `webpresent.html`
- Modify: `index.html`
- Create: `img/cash-release.svg`
- Create: `img/receivables-risk.svg`
- Preserve: `flow-interactions.js`

**Interfaces:**
- Consumes: the current protected flow regions in `webpresent.html` and the supplied 7-22 source directory.
- Produces: a 23-slide `webpresent.html` with flow IDs `s7`, `s8`, and `s9` at pages 10-12 and correct `data-go` targets.

- [ ] **Step 1: Add helpers and exact preservation hashes to the content tests**

Add `hashlib` and the following constants/helpers near the top of `tests/test_webpresent.py`:

```python
import hashlib


FLOW_INTERACTIONS_PATH = HTML_PATH.parent / "flow-interactions.js"
INDEX_PATH = HTML_PATH.parent / "index.html"
EXPECTED_SLIDE_IDS = [
    "s1", "s2", "s3", "s4", "s10", "s11", "s12", "s13", "s6",
    "s7", "s8", "s9", "s17", "pain-core", "pain-billing",
    "solution-billing", "pain-capacity", "solution-capacity", "s21",
    "benefit-scheduling-qual", "benefit-cash-release", "s24", "s25",
]
PROTECTED_HASHES = {
    "flow_interactions": "5cbf2f7384885c5982dd195abfe45688426ad2af83377022023691f40a779729",
    "flow_slides": "04cf9f0163cb56b2f04f24cd8b1248f990a71dbc3c89a4bbb06111aa81fb1384",
    "navigation": "b02971e3a06a93c85dff9a3cd4e06301e8619c91644e255102b37747eabe3914",
    "flow_script": "0f88f1522166de9dbe6a994eb2c3d0ffd6f03efea8d8002206bfa524a323b573",
}


def source_between(source, start_marker, end_marker):
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def sha256_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
```

- [ ] **Step 2: Replace stale first-report assertions with the second-report contract**

Replace `test_deletes_p5_and_swaps_process_before_flowcharts`, `test_page_11_uses_uploaded_site_photo_and_revised_copy`, the obsolete tests for `s18`, `s19`, `s20`, `s22`, and `s23`, `test_team_members_follow_sd_mm_pp_fi_co_order`, and `test_page_19_and_page_21_keybars_are_raised` with these focused methods. Keep all existing flow integration, visual-state, reset, page-number, and navigation-button tests. In `test_flow_interaction_visual_states`, change the keyframe prelude from `0%, 100%` to the source-accurate `0%,100%`.

```python
def test_second_report_slide_order_and_unique_ids(self):
    slide_ids = [slide["id"] for slide in self.slides]
    self.assertEqual(EXPECTED_SLIDE_IDS, slide_ids)
    self.assertEqual(len(slide_ids), len(set(slide_ids)))

def test_second_report_content_markers(self):
    expected = {
        "s1": ["第二次報告", "從 Excel 到 SAP 數位轉型起點"],
        "pain-core": ["流程中的問題點", "營收無法完整轉化"],
        "pain-billing": ["工作做完，不一定完整變成收入", "漏請、少請"],
        "solution-billing": ["SD + FI-AR", "接單時即建立可請款依據"],
        "pain-capacity": ["生產排程靠老闆經驗", "無法交接與驗證"],
        "solution-capacity": ["SD + PP + MM", "可承諾的產能"],
        "benefit-scheduling-qual": ["生產排程可視化", "建立可交接的排程知識"],
        "benefit-cash-release": ["縮短 113 天", "1,084 萬"],
    }
    for slide_id, markers in expected.items():
        for marker in markers:
            self.assertIn(marker, self.by_id[slide_id]["text"])

def test_navigation_targets_match_second_report_dom_order(self):
    self.assertEqual(["3", "5", "9", "13", "19", "22", "23"], self.by_id["s2"]["data_go"])
    self.assertEqual(["11", "12"], self.by_id["s7"]["data_go"])
    self.assertEqual(["10", "12"], self.by_id["s8"]["data_go"])
    self.assertEqual(["10", "11"], self.by_id["s9"]["data_go"])

def test_second_report_title_footer_and_team_order(self):
    self.assertIn("風琦有限公司 × SAP 導入評估｜第二次報告", self.source)
    self.assertNotIn("SAP 導入評估｜第一次報告", self.source)
    self.assertIn("風琦有限公司 SAP 導入評估｜第二次報告", INDEX_PATH.read_text(encoding="utf-8"))
    team = section_source(self.source, "s24")
    self.assertEqual(
        ["Betty", "Yao", "Victor", "Lisa", "Bella"],
        re.findall(r'<div class="member"><img[^>]+alt="([^"]+)"', team),
    )

def test_all_local_resources_exist(self):
    references = re.findall(r'(?:src|href)="([^"?#]+)"', self.source)
    local = [ref for ref in references if not re.match(r"^(?:https?:|data:|javascript:)", ref)]
    missing = [ref for ref in local if not (HTML_PATH.parent / ref).is_file()]
    self.assertEqual([], missing)
    for name in ["cash-release.svg", "receivables-risk.svg"]:
        resource = HTML_PATH.parent / "img" / name
        self.assertTrue(resource.is_file())
        self.assertIn("<svg", resource.read_text(encoding="utf-8"))

def test_protected_flow_sources_match_the_approved_baseline(self):
    flow_slides = source_between(
        self.source,
        '      <section class="slide" id="s7"',
        '      <section class="slide dark" id="s17"',
    )
    navigation = source_between(self.source, "    function go(i) {", "    function fitStage() {")
    flow_script = source_between(self.source, "    /* 直向泳道流程圖", "  </script>")
    self.assertEqual(PROTECTED_HASHES["flow_slides"], sha256_text(flow_slides))
    self.assertEqual(PROTECTED_HASHES["navigation"], sha256_text(navigation))
    self.assertEqual(PROTECTED_HASHES["flow_script"], sha256_text(flow_script))
    self.assertEqual(
        PROTECTED_HASHES["flow_interactions"],
        hashlib.sha256(FLOW_INTERACTIONS_PATH.read_bytes()).hexdigest(),
    )
```

- [ ] **Step 3: Run the new contract tests and verify RED**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  tests.test_webpresent.WebpresentContentTest.test_second_report_slide_order_and_unique_ids \
  tests.test_webpresent.WebpresentContentTest.test_second_report_content_markers \
  tests.test_webpresent.WebpresentContentTest.test_navigation_targets_match_second_report_dom_order \
  tests.test_webpresent.WebpresentContentTest.test_all_local_resources_exist \
  tests.test_webpresent.WebpresentContentTest.test_protected_flow_sources_match_the_approved_baseline
```

Expected: FAIL because the target still has 24 first-report slides, lacks the two SVG assets, and uses the old DOM navigation targets.

- [ ] **Step 4: Create and run the deterministic one-time composition script**

Create `/tmp/fongchi-merge-second-report.mjs` with this complete implementation:

```javascript
import assert from 'node:assert/strict';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const targetRoot = resolve(process.cwd());
const sourceRoot = resolve(process.argv[2]);
const normalize = (value) => value.replace(/\r\n?/g, '\n');

function locate(value, startMarker, endMarker) {
  const start = value.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = value.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return { start, end, body: value.slice(start, end) };
}

function replaceBetween(value, startMarker, endMarker, replacement) {
  const range = locate(value, startMarker, endMarker);
  return value.slice(0, range.start) + replacement + value.slice(range.end);
}

const current = normalize(await readFile(join(targetRoot, 'webpresent.html'), 'utf8'));
let supplied = normalize(await readFile(join(sourceRoot, 'webpresent.html'), 'utf8'));

let flowSlides = locate(
  current,
  '      <section class="slide" id="s7"',
  '      <!-- ═════ 17 章節 04 痛點 ═════ -->',
).body;
const flowPageMap = Object.freeze({ 13: 10, 14: 11, 15: 12 });
flowSlides = flowSlides.replace(/data-go="(13|14|15)"/g, (_, page) => `data-go="${flowPageMap[page]}"`);

const navMarkup = locate(current, '  <div id="navBtns">', '  <script>').body;
const navigation = locate(current, '    function go(i) {', '    function fitStage() {').body;
const flowScript = locate(current, '    /* 直向泳道流程圖', '  </script>').body;

supplied = replaceBetween(
  supplied,
  '      <section class="slide" id="s7"',
  '      <section class="slide dark" id="s17"',
  flowSlides,
);
supplied = replaceBetween(supplied, '  <div id="navBtns">', '  <script>', navMarkup);
supplied = replaceBetween(supplied, '    function go(i) {', '    function fitStage() {', navigation);
supplied = replaceBetween(supplied, '    /* 直向泳道流程圖', '  </script>', flowScript);

let toc = locate(
  supplied,
  '      <section class="slide" id="s2"',
  '      <section class="slide dark" id="s3"',
).body;
toc = toc.replace('data-go="23"', 'data-go="22"').replace('data-go="24"', 'data-go="23"');
supplied = replaceBetween(
  supplied,
  '      <section class="slide" id="s2"',
  '      <section class="slide dark" id="s3"',
  toc,
);

await writeFile(join(targetRoot, 'webpresent.html'), supplied.replace(/\n*$/, '\n'), 'utf8');
await writeFile(
  join(targetRoot, 'index.html'),
  normalize(await readFile(join(sourceRoot, 'index.html'), 'utf8')).replace(/\n*$/, '\n'),
  'utf8',
);
for (const filename of ['cash-release.svg', 'receivables-risk.svg']) {
  await copyFile(join(sourceRoot, 'img', filename), join(targetRoot, 'img', filename));
}
```

Run:

```bash
node /tmp/fongchi-merge-second-report.mjs '/Users/zhuangchengfu/Downloads/7-22_fongchipresent第二次報告'
```

Then delete only the temporary script created in this task.

- [ ] **Step 5: Run static tests and make them GREEN**

Run:

```bash
node --test tests/test_flow_interactions.js
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_webpresent
node --check flow-interactions.js
node .agents/skills/editing-fongchi-flowcharts/scripts/verify-flowcharts.mjs webpresent.html \
  --expect-node 'fbox1:n2:t=產能充足？' \
  --expect-node 'fbox1:n3:t=新舊案?' \
  --expect-node 'fbox1:n7n:t=報價異議' \
  --expect-edge 'fbox3:a1:a2:lb=舊案沿用歷史價格'
```

Expected:

- Node flow tests: 14/14 PASS.
- Python content tests: all tests PASS after obsolete first-report assertions are replaced.
- JavaScript syntax: PASS.
- Flowchart verifier: no changed nodes or edges; the only permitted diagnostic is the unchanged accepted `fbox1:f2->n8 unknown route railR` baseline.

- [ ] **Step 6: Commit the composed presentation and static contract**

Review and stage only:

```bash
git diff -- webpresent.html index.html tests/test_webpresent.py
git add webpresent.html index.html tests/test_webpresent.py img/cash-release.svg img/receivables-risk.svg
git diff --cached --name-status
git commit -m "feat: merge second report with preserved flows"
```

The staged list must contain exactly five paths (`webpresent.html`, `index.html`, `tests/test_webpresent.py`, and the two SVG files) and must not contain `.DS_Store` or `.vscode/settings.json`.

---

### Task 2: Verify Browser Behavior, Layout, And Resource Integrity

**Files:**
- Temporary: `.superpowers/sdd/second-report-browser-check.mjs`
- Temporary: `.superpowers/sdd/second-report-*.png`
- Modify only if a test proves necessary: `webpresent.html`
- Test: `tests/test_flow_interactions.js`
- Test: `tests/test_webpresent.py`

**Interfaces:**
- Consumes: the 23-slide composed deck from Task 1.
- Produces: browser evidence for flow navigation, non-flow rendering, local resources, and viewport safety.

- [ ] **Step 1: Create the browser verifier from the accepted interaction matrix**

Copy the existing ignored verifier from:

```text
/Users/zhuangchengfu/Downloads/fongchipresent 2/.worktrees/flow-first-forward-navigation/.superpowers/sdd/bidirectional-flow-browser-check.mjs
```

to `.superpowers/sdd/second-report-browser-check.mjs`, then make these exact pager-case updates:

```javascript
const pagerCases = [
  { slideId: 's7', boxId: 'fbox1', dataGo: '11', targetSlideId: 's8' },
  { slideId: 's8', boxId: 'fbox2', dataGo: '12', targetSlideId: 's9' },
  { slideId: 's9', boxId: 'fbox3', dataGo: '10', targetSlideId: 's7' },
];
```

Add these post-load assertions before the flow matrix:

```javascript
const integrity = await page.evaluate(() => ({
  slideIds: [...document.querySelectorAll('.slide')].map((slide) => slide.id),
  title: document.title,
  localImages: [...document.images].map((img) => ({ src: img.getAttribute('src'), complete: img.complete, width: img.naturalWidth })),
}));
assert.equal(integrity.slideIds.length, 23);
assert.equal(new Set(integrity.slideIds).size, 23);
assert.match(integrity.title, /第二次報告/);
assert.deepEqual(integrity.localImages.filter((image) => !image.complete || image.width === 0), []);
```

Retain all five forward keys, four backward keys, direct button checks, focused-button checks, branch restoration checks, final-node page advance, reset checks, five viewport checks, and the three flow screenshots.

- [ ] **Step 2: Add non-flow content and overflow screenshots**

At `1600x900`, activate and capture these slide IDs:

```javascript
const reportSlides = [
  'pain-core',
  'solution-billing',
  'solution-capacity',
  'benefit-scheduling-qual',
  'benefit-cash-release',
];
for (const slideId of reportSlides) {
  await page.evaluate((id) => {
    const slides = [...document.querySelectorAll('.slide')];
    window.go(slides.findIndex((slide) => slide.id === id));
  }, slideId);
  await page.waitForTimeout(500);
  const overflow = await page.locator(`#${slideId}`).evaluate((slide) => ({
    horizontal: slide.scrollWidth > slide.clientWidth + 1,
    vertical: slide.scrollHeight > slide.clientHeight + 1,
  }));
  assert.deepEqual(overflow, { horizontal: false, vertical: false });
  await page.screenshot({
    path: `.superpowers/sdd/second-report-${slideId}.png`,
    fullPage: true,
  });
}
```

- [ ] **Step 3: Run the browser verifier**

Run:

```bash
node .superpowers/sdd/second-report-browser-check.mjs
```

Expected: 68 flow behavior cases, 5 viewport checks, 0 page errors, 0 failed local resources, 3 flow screenshots, and 5 second-report screenshots.

- [ ] **Step 4: Inspect all eight screenshots**

Inspect the settled flow screenshots and the five second-report screenshots at original detail. Confirm:

- Flow nodes, labels, branches, reset button, page number, and pager do not overlap.
- The new story and benefit slides have no clipped text or occluded visuals.
- `cash-release.svg` and `receivables-risk.svg` display rather than blank placeholders.
- The presentation remains framed inside the 1600x900 stage at desktop and mobile scaling.

- [ ] **Step 5: Apply only evidence-backed layout fixes, then rerun all checks**

If a browser assertion or screenshot reveals a defect, patch only the affected 7-22 non-flow CSS/markup. Do not modify the protected flow regions or `flow-interactions.js`. Rerun Steps 3-4 after every fix.

- [ ] **Step 6: Commit any required layout correction**

If Task 2 changed tracked files:

```bash
git add webpresent.html tests/test_webpresent.py
git commit -m "fix: refine second-report presentation layout"
```

If no tracked files changed, do not create an empty commit.

---

### Task 3: Final Integrity Review And Handoff

**Files:**
- Review: `webpresent.html`
- Review: `index.html`
- Review: `flow-interactions.js`
- Review: `tests/test_webpresent.py`
- Review: `tests/test_flow_interactions.js`
- Review: `img/cash-release.svg`
- Review: `img/receivables-risk.svg`

**Interfaces:**
- Consumes: the static and browser-verified presentation from Tasks 1-2.
- Produces: a clean task diff and a merge-ready feature branch while preserving unrelated working-tree changes.

- [ ] **Step 1: Run the full verification gate from a fresh process**

```bash
node --test tests/test_flow_interactions.js
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_webpresent
node --check flow-interactions.js
node .superpowers/sdd/second-report-browser-check.mjs
git diff --check f04f177..HEAD
```

Expected: Node 14/14 PASS, Python all PASS, syntax PASS, browser matrix PASS, and no whitespace errors. The unchanged accepted `railR` verifier diagnostic must be reported separately and must not gain another diagnostic.

- [ ] **Step 2: Verify source and repository integrity**

```bash
git status --short
git diff --name-status f04f177..HEAD
git log --oneline --decorate f04f177..HEAD
```

Confirm:

- Tracked task changes are limited to the approved spec/plan, `webpresent.html`, `index.html`, `tests/test_webpresent.py`, and the two SVG assets.
- `flow-interactions.js` and `tests/test_flow_interactions.js` are unchanged from `f04f177`.
- `.DS_Store`, `docs/.DS_Store`, and `.vscode/settings.json` remain local and uncommitted.
- No source docs, Python caches, browser screenshots, or evidence JSON are tracked.

- [ ] **Step 3: Review the final diff for behavioral regressions**

Inspect the complete diff and verify:

- Every non-flow slide is from the 7-22 report.
- The footer and document titles say second report.
- The four protected-region hashes match the constants in `tests/test_webpresent.py`.
- The table of contents targets pages 3, 5, 9, 13, 19, 22, and 23.
- Flow pager targets are 10, 11, and 12 as specified.

- [ ] **Step 4: Remove only temporary verification artifacts**

Delete `.superpowers/sdd/second-report-browser-check.mjs` and its generated screenshots/evidence after recording the final counts. Do not delete user files or unrelated existing artifacts.

- [ ] **Step 5: Report completion state**

Report the branch name, final commits, exact test counts, browser counts, the unchanged accepted verifier diagnostic, files changed, and the status of unrelated local modifications. Do not merge or push unless the user explicitly requests it.
