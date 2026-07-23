import hashlib
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


HTML_PATH = Path(__file__).resolve().parents[1] / "webpresent.html"
FLOW_INTERACTIONS_PATH = HTML_PATH.parent / "flow-interactions.js"
INDEX_PATH = HTML_PATH.parent / "index.html"
EXPECTED_SLIDE_IDS = [
    "s1", "s2", "s3", "s4", "s10", "s11", "s12", "s13", "s6",
    "s7", "s8", "s9", "s17", "pain-core", "pain-billing",
    "solution-billing", "pain-capacity", "solution-capacity", "s21",
    "benefit-cash-release", "benefit-scheduling-qual", "s24", "s25",
]
PROTECTED_HASHES = {
    "flow_interactions": "5cbf2f7384885c5982dd195abfe45688426ad2af83377022023691f40a779729",
    "flow_slides": "04cf9f0163cb56b2f04f24cd8b1248f990a71dbc3c89a4bbb06111aa81fb1384",
    "navigation": "88bacaebbb5bc664aaefccfc15a71b874887b15c2356754f7144c3bc222f0ebb",
    "flow_script": "2dcf9db80eada44f720695affd2bafada6a22a9beb40d23e3886c0ac6806374f",
}


def source_between(source, start_marker, end_marker):
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def sha256_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class SlideParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.slides = []
        self._slide = None
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "section" and "slide" in classes:
            self._slide = {
                "id": attrs.get("id"),
                "text": [],
                "data_go": [],
                "classes": classes,
            }
            self.slides.append(self._slide)
            self._depth = 1
            return

        if self._slide is not None:
            self._depth += 1
            if "data-go" in attrs:
                self._slide["data_go"].append(attrs["data-go"])

    def handle_endtag(self, tag):
        if self._slide is None:
            return
        self._depth -= 1
        if self._depth == 0:
            self._slide = None

    def handle_data(self, data):
        if self._slide is not None:
            text = " ".join(data.split())
            if text:
                self._slide["text"].append(text)


def load_deck():
    source = HTML_PATH.read_text(encoding="utf-8")
    parser = SlideParser()
    parser.feed(source)
    for slide in parser.slides:
        slide["text"] = " ".join(slide["text"])
    return source, parser.slides


def section_source(source, section_id):
    match = re.search(
        rf'<section\b[^>]*\bid="{re.escape(section_id)}"[^>]*>[\s\S]*?</section>',
        source,
    )
    if match is None:
        raise AssertionError(f"missing section #{section_id}")
    return match.group(0)


def css_block(source, prelude):
    pattern = re.escape(prelude).replace(",", r",\s*")
    match = re.search(rf"{pattern}\s*\{{", source)
    if match is None:
        raise AssertionError(f"missing CSS block: {prelude}")

    depth = 0
    opening_brace = match.end() - 1
    for index in range(opening_brace, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[opening_brace + 1 : index]

    raise AssertionError(f"unterminated CSS block: {prelude}")


def css_declarations(block):
    declarations = {}
    for declaration in block.split(";"):
        declaration = declaration.strip()
        if not declaration:
            continue
        property_name, value = declaration.split(":", 1)
        declarations[property_name.strip()] = re.sub(r"\s+", " ", value.strip())
    return declarations


class WebpresentContentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source, cls.slides = load_deck()
        cls.by_id = {slide["id"]: slide for slide in cls.slides}

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
            "benefit-cash-release": ["縮短兩個月", "62.4%", "34.9%", "2.6%", "364 萬"],
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
        self.assertIn(
            "const isDeckNavigationTarget = target => "
            "target?.closest?.('[data-flow-navigation]')",
            normalized,
        )
        self.assertIn("document.getElementById('stage').addEventListener('click', e =>", normalized)
        self.assertIn("if (e.button !== 0 || isInteractiveNavigationTarget(e.target)) return", normalized)
        self.assertIn(
            "if (window.FongchiFlowInteractions?.FLOW_BY_SLIDE[slides[cur].id]) return",
            normalized,
        )
        self.assertIn('function advancePresentation()', normalized)
        self.assertIn('window.dioFlowController?.advanceActiveUntilComplete()', normalized)
        self.assertIn("result.status === 'complete'", normalized)
        self.assertIn('function retreatPresentation()', normalized)
        self.assertIn('window.dioFlowController?.retreatActiveUntilStart()', normalized)
        self.assertIn("result.status === 'start-boundary'", normalized)
        self.assertIn('window.dioFlowController?.resetActive()', normalized)
        self.assertIn('function nextSlideIndex()', normalized)
        self.assertIn('return cur === slides.length - 1 ? 0 : cur + 1', normalized)
        self.assertIn("document.getElementById('btnNext').onclick = () => go(nextSlideIndex())", normalized)
        self.assertIn("document.getElementById('btnPrev').onclick = () => go(cur - 1)", normalized)
        self.assertIn('advancePresentation();', normalized)
        self.assertIn('retreatPresentation();', normalized)
        self.assertIn('data-flow-navigation', self.source)

        self.assertIn(
            "const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']",
            normalized,
        )
        self.assertIn(
            "const previousKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']",
            normalized,
        )
        self.assertIn(
            "if (isInteractiveNavigationTarget(e.target) && !isDeckNavigationTarget(e.target)) return",
            normalized,
        )
        self.assertIn("if (nextKeys.includes(e.key))", normalized)
        self.assertIn("if (previousKeys.includes(e.key))", normalized)
        self.assertGreaterEqual(normalized.count("e.preventDefault()"), 2)
        self.assertIn("if (e.key === 'Home') go(0)", normalized)
        self.assertIn("if (e.key === 'End') go(slides.length - 1)", normalized)

    def test_next_navigation_wraps_from_final_slide_to_first_slide(self):
        normalized = re.sub(r"\s+", " ", self.source)
        self.assertIn("function nextSlideIndex()", normalized)
        self.assertIn("go(nextSlideIndex())", normalized)
        self.assertNotIn("if (!result || result.status === 'inactive' || result.status === 'complete') go(cur + 1)", normalized)

    def test_preserves_user_updated_flowchart_wording(self):
        for wording in ["產能充足？", "新舊案?", "報價異議", "舊案沿用歷史價格"]:
            self.assertIn(wording, self.source)

    def test_page_2_keeps_only_toc_headings(self):
        source = section_source(self.source, "s2")
        self.assertNotIn('class="d"', source)
        for subtitle in [
            "風琦是誰？做什麼？",
            "從印刷開始到完成品",
            "直向泳道 × 3 頁，點擊點亮",
            "現況・後果・問題總結",
            "對應 SAP 模組",
            "現金流 ✕ 營運穩定",
            "顧問團隊 ALIVE",
        ]:
            self.assertNotIn(subtitle, source)


    def test_photo_slide_page_numbers_are_visible(self):
        match = re.search(r"\.hasPhoto \.pgno\s*\{([^}]*)\}", self.source)
        self.assertIsNotNone(match)
        style = match.group(1)
        self.assertNotIn("display:none", style.replace(" ", ""))
        self.assertRegex(style, r"background\s*:")
        self.assertRegex(style, r"z-index\s*:")

    def test_page_numbers_are_created_for_every_slide(self):
        loop = re.search(
            r"slides\s*\.\s*forEach\(\s*\(\s*s\s*,\s*i\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\);",
            self.source,
        )
        self.assertIsNotNone(loop)
        self.assertNotIn("if(i===0)return", loop.group(1).replace(" ", ""))
        self.assertRegex(
            loop.group(1),
            r"p\s*\.\s*textContent\s*=\s*\(\s*i\s*\+\s*1\s*\)\s*\+\s*' / '\s*\+\s*slides\s*\.\s*length",
        )

    def test_flowchart_two_single_letter_labels_clear_nodes(self):
        normalized_source = re.sub(r"\s+", "", self.source)
        self.assertIn(
            "{f:'b2',t:'b3',lb:'Y',lc:'#18A66A',small:1,loff:[0,-1]}",
            normalized_source,
        )
        self.assertIn(
            "{f:'b6',t:'b6n',lb:'N',lc:'#E4392E',small:1,loff:[0,-1]}",
            normalized_source,
        )

    def test_flow_interaction_controller_is_integrated(self):
        self.assertIn('<script src="flow-interactions.js"></script>', self.source)
        legacy_start = self.source.index("function buildDrawio1()")
        active_start = self.source.index("function buildDio(boxId, mkId")
        active_end = self.source.index("/* ── 流程圖①", active_start)
        legacy_block = self.source[legacy_start:active_start]
        active_block = self.source[active_start:active_end]
        self.assertNotIn("data-node-id", legacy_block)
        self.assertIn("'data-node-id': n.id", active_block)
        self.assertIn(
            "FongchiFlowInteractions.createFlowInteractionController({ documentRef: document })",
            self.source,
        )
        self.assertIn("dioFlowController.bindGlobalPointer(document)", self.source)
        self.assertIn("window.dioFlowController = dioFlowController", self.source)

        interaction_script = self.source.index('<script src="flow-interactions.js"></script>')
        three_script = self.source.index('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/')
        self.assertLess(interaction_script, three_script)

        active_fbox3 = self.source.index("buildDio('fbox3'")
        controller_startup = self.source.index(
            "const dioFlowController = FongchiFlowInteractions.createFlowInteractionController",
        )
        self.assertGreater(controller_startup, active_fbox3)

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

        page_number = css_block(self.source, ".pgno")
        self.assertEqual("90px", css_declarations(page_number)["right"])
        self.assertEqual("26px", css_declarations(page_number)["bottom"])

    def test_flow_interaction_visual_states(self):
        current = css_block(self.source, ".dio.flow-current .shape")
        visited = css_block(self.source, ".dio.flow-visited .shape")
        visited_text = css_block(
            self.source,
            ".dio.flow-visited text,\n    .dio.flow-visited .subt",
        )
        keyframes = css_block(self.source, "@keyframes dioNodePulse")
        reduced_motion = css_block(
            self.source,
            "@media (prefers-reduced-motion: reduce)",
        )

        self.assertEqual(
            {
                "stroke": "#FF8A00 !important",
                "stroke-width": "5 !important",
                "filter": (
                    "drop-shadow(0 0 5px rgba(255, 138, 0, .9)) "
                    "drop-shadow(0 0 12px rgba(255, 138, 0, .7))"
                ),
                "animation": "dioNodePulse 1.1s ease-in-out infinite",
            },
            css_declarations(current),
        )
        self.assertEqual(
            {
                "fill": "#0D2B5C !important",
                "stroke": "#0D2B5C !important",
                "stroke-dasharray": "none !important",
                "filter": "none",
                "animation": "none",
            },
            css_declarations(visited),
        )
        self.assertEqual(
            {"fill": "#FFFFFF !important"},
            css_declarations(visited_text),
        )
        self.assertEqual(
            {
                "filter": (
                    "drop-shadow(0 0 4px rgba(255, 138, 0, .75)) "
                    "drop-shadow(0 0 9px rgba(255, 138, 0, .55))"
                ),
            },
            css_declarations(css_block(keyframes, "0%,100%")),
        )
        self.assertEqual(
            {
                "filter": (
                    "drop-shadow(0 0 9px rgba(255, 138, 0, 1)) "
                    "drop-shadow(0 0 18px rgba(255, 138, 0, .9))"
                ),
            },
            css_declarations(css_block(keyframes, "50%")),
        )
        self.assertNotRegex(keyframes, r"\btransform\s*:")
        self.assertEqual(
            {"animation": "none"},
            css_declarations(
                css_block(reduced_motion, ".dio.flow-current .shape"),
            ),
        )

    def test_p25_removes_the_last_line(self):
        text = self.by_id["s25"]["text"]
        self.assertIn("顧問團隊 ALIVE × 風琦有限公司", text)
        self.assertNotIn("期待與您討論下一步", text)

    def test_final_slide_has_a_bottom_right_return_to_contents_button(self):
        final_slide = section_source(self.source, "s25")
        self.assertRegex(
            final_slide,
            r'<button\b[^>]*class="returnToc"[^>]*data-go="2"[^>]*'
            r'aria-label="返回目錄"[^>]*>[\s\S]*?返回目錄[\s\S]*?</button>',
        )
        style = css_declarations(css_block(self.source, ".returnToc"))
        self.assertEqual("absolute", style.get("position"))
        self.assertRegex(style.get("right", ""), r"(?:px|vw|clamp)")
        self.assertRegex(style.get("bottom", ""), r"(?:px|vh|clamp)")
        self.assertRegex(style.get("z-index", ""), r"\d+")

    def test_raised_keybar_style_exists(self):
        match = re.search(r"\.keybar\.raised\s*\{([^}]*)\}", self.source)
        self.assertIsNotNone(match)
        self.assertRegex(match.group(1), r"bottom\s*:\s*(?:[89]\d|1\d\d)px")

    def test_navigation_buttons_are_centered_on_opposite_screen_edges(self):
        nav = re.search(r"#navBtns\s*\{([^}]*)\}", self.source)
        buttons = re.search(r"#navBtns button\s*\{([^}]*)\}", self.source)
        self.assertIsNotNone(nav)
        self.assertIsNotNone(buttons)
        self.assertRegex(nav.group(1), r"inset\s*:\s*0")
        self.assertRegex(nav.group(1), r"pointer-events\s*:\s*none")
        self.assertRegex(buttons.group(1), r"position\s*:\s*absolute")
        self.assertRegex(buttons.group(1), r"top\s*:\s*50%")
        self.assertRegex(buttons.group(1), r"transform\s*:\s*translateY\(-50%\)")
        self.assertRegex(buttons.group(1), r"pointer-events\s*:\s*auto")
        self.assertRegex(self.source, r"#btnPrev\s*\{[^}]*left\s*:\s*0(?:px)?")
        self.assertRegex(self.source, r"#btnNext\s*\{[^}]*right\s*:\s*0(?:px)?")

    def test_all_page_numbers_share_the_bottom_right_position(self):
        match = re.search(r"\.pgno\s*\{([^}]*)\}", self.source)
        self.assertIsNotNone(match)
        self.assertRegex(match.group(1), r"right\s*:\s*90px")
        self.assertRegex(match.group(1), r"bottom\s*:\s*26px")
        photo = re.search(r"\.hasPhoto \.pgno\s*\{([^}]*)\}", self.source)
        self.assertIsNotNone(photo)
        self.assertNotRegex(photo.group(1), r"(?:right|bottom)\s*:")

    def test_navigation_buttons_shrink_on_narrow_screens(self):
        self.assertRegex(
            self.source,
            r"@media\s*\(max-width:900px\)\s*\{[\s\S]*?"
            r"#navBtns button\s*\{[^}]*width\s*:\s*32px;[^}]*height\s*:\s*48px;"
            r"[^}]*box-shadow\s*:\s*none",
        )
        self.assertRegex(
            self.source,
            r"@media\s*\(max-width:700px\)\s*\{[\s\S]*?"
            r"#navBtns button\s*\{[^}]*width\s*:\s*24px;[^}]*height\s*:\s*44px;"
            r"[^}]*box-shadow\s*:\s*none",
        )
        self.assertRegex(
            self.source,
            r"@media\s*\(max-width:420px\)\s*\{[\s\S]*?"
            r"#navBtns button\s*\{[^}]*width\s*:\s*18px;[^}]*height\s*:\s*40px",
        )


if __name__ == "__main__":
    unittest.main()
