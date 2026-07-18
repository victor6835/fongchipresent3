import re
import unittest
from html.parser import HTMLParser
from pathlib import Path


HTML_PATH = Path(__file__).resolve().parents[1] / "webpresent.html"
SITE_PHOTO_TARGET = HTML_PATH.parent / "img" / "site-installation.jpg"


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
    match = re.search(rf"{re.escape(prelude)}\s*\{{", source)
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

    def test_deletes_p5_and_swaps_process_before_flowcharts(self):
        self.assertEqual(24, len(self.slides))
        self.assertNotIn("s5", self.by_id)

        expected_markers = [
            "訂單完整過程",
            "設計與整檔",
            "接單與發包單",
            "噴墨列印",
            "後加工｜冷裱・貼合・裁切",
            "雷射切割與特殊加工",
            "清點・出貨・施工驗收",
            "流程圖 （As-Is）",
            "流程圖 ①｜接單與報價",
            "流程圖 ②｜生產製造",
            "流程圖 ③｜交付與請款",
            "痛點 兩個問題",
        ]
        ordered_text = [slide["text"] for slide in self.slides[4:16]]
        for marker, text in zip(expected_markers, ordered_text):
            self.assertIn(marker, text)
        self.assertIn("CHAPTER 02", self.slides[4]["text"])
        self.assertIn("CHAPTER 03", self.slides[11]["text"])

    def test_navigation_targets_match_the_new_dom_order(self):
        toc = self.by_id["s2"]
        self.assertEqual(["3", "5", "12", "16", "20", "22", "23"], toc["data_go"])
        self.assertEqual(["14", "15"], self.by_id["s7"]["data_go"])
        self.assertEqual(["13", "15"], self.by_id["s8"]["data_go"])
        self.assertEqual(["13", "14"], self.by_id["s9"]["data_go"])

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
        self.assertIn('function advancePresentation()', normalized)
        self.assertIn('window.dioFlowController?.advanceActiveUntilComplete()', normalized)
        self.assertIn("result.status === 'complete'", normalized)
        self.assertIn('function retreatPresentation()', normalized)
        self.assertIn('window.dioFlowController?.retreatActiveUntilStart()', normalized)
        self.assertIn("result.status === 'start-boundary'", normalized)
        self.assertIn('window.dioFlowController?.resetActive()', normalized)
        self.assertIn("document.getElementById('btnNext').onclick = () => go(cur + 1)", normalized)
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
        self.assertIn("if (isInteractiveNavigationTarget(e.target)) return", normalized)
        self.assertIn("if (nextKeys.includes(e.key))", normalized)
        self.assertIn("if (previousKeys.includes(e.key))", normalized)
        self.assertGreaterEqual(normalized.count("e.preventDefault()"), 2)
        self.assertIn("if (e.key === 'Home') go(0)", normalized)
        self.assertIn("if (e.key === 'End') go(slides.length - 1)", normalized)

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

    def test_page_11_uses_uploaded_site_photo_and_revised_copy(self):
        source = section_source(self.source, "s16")
        text = self.by_id["s16"]["text"]
        self.assertIn("完成品經人工彙整後請款", text)
        self.assertNotIn("完成品 ≠現金", text)
        self.assertIn('src="img/site-installation.jpg"', source)
        self.assertIn("現場施工", source)
        self.assertNotIn('class="placeholder"', source)
        self.assertTrue(SITE_PHOTO_TARGET.is_file())
        photo = SITE_PHOTO_TARGET.read_bytes()
        self.assertGreater(len(photo), 100_000)
        self.assertTrue(photo.startswith(b"\xff\xd8"))
        self.assertTrue(photo.endswith(b"\xff\xd9"))

    def test_p18_copy_and_raised_core_message(self):
        text = self.by_id["s18"]["text"]
        self.assertIn("痛點一：發包單無法即時追蹤訂單＆金額", text)
        self.assertIn("單上沒有價格", text)
        self.assertIn("發包單＝報價單＝生產單＝訂單＝請款依據", text)
        self.assertNotIn("單上沒有即時金額", text)
        self.assertRegex(
            self.source,
            r'<section class="slide" id="s18">[\s\S]*?<div class="keybar warn raised">',
        )

    def test_p19_core_message_is_raised(self):
        self.assertRegex(
            self.source,
            r'<section class="slide" id="s19">[\s\S]*?<div class="keybar warn raised">',
        )

    def test_p20_uses_the_attachment_content(self):
        text = self.by_id["s20"]["text"]
        expected = [
            "問題總結：同一張發包單卡住兩條生命線",
            "前端問題：訂單無法轉化為產能",
            "發包單沒有被拆解為工序、設備時間與人力需求。",
            "老闆只能依靠經驗判斷是否接單。",
            "產能空檔被隱藏在排程裡，無法被有效使用。",
            "後端問題：完工無法轉化為現金",
            "完工資料沒有即時確認與彙整。",
            "請款仍依賴人工翻找紙本與 Excel 整理。",
            "應收帳款建立延遲，現金回收速度變慢。",
            "企業需要的不是更多紙本或更多 Excel，而是一套串起訂單、產能、完工與請款的 ERP 流程。",
        ]
        for phrase in expected:
            self.assertIn(phrase, text)

    def test_p22_maps_each_solution_to_a_pain_point(self):
        text = self.by_id["s22"]["text"]
        self.assertIn("針對痛點一", text)
        self.assertIn("針對痛點二", text)
        self.assertIn("發包單系統化 → SD ＋ FI", text)
        self.assertIn("追蹤訂單：接 SD 銷售配銷", text)
        self.assertNotIn("發包單金額化", text)
        self.assertNotIn("不是做電子發包單，而是把", text)

    def test_p23_expected_benefit_copy(self):
        text = self.by_id["s23"]["text"]
        for phrase in ["減少漏請款項", "可追蹤訂單"]:
            self.assertIn(phrase, text)
        for phrase in [
            "減少漏請少請",
            "應收更清楚",
            "縮短 3–5 個月請款延遲",
            "縮短至一個月請款",
            "收款更快速",
            "可交接",
        ]:
            self.assertNotIn(phrase, text)

    def test_page_22_removes_module_parentheses_and_one_benefit(self):
        source = section_source(self.source, "s23")
        text = self.by_id["s23"]["text"]
        self.assertIn("現金流效益", text)
        self.assertIn("營運效益", text)
        self.assertNotIn("現金流效益（FI／SD）", text)
        self.assertNotIn("營運效益（PP／MM）", text)
        self.assertNotIn("縮短至一個月請款", text)
        self.assertNotIn("收款更快速", text)
        self.assertEqual(7, source.count('<div class="ben">'))
        self.assertIn('<div class="benGrid three">', source)

    def test_team_members_follow_sd_mm_pp_fi_co_order(self):
        source = section_source(self.source, "s24")
        self.assertEqual(
            ["Betty", "Lisa", "Victor", "Yao", "Bella"],
            re.findall(r'<div class="member"><img[^>]+alt="([^"]+)"', source),
        )
        modules = re.findall(r'<span class="rl">([^<]+)</span>', source)
        self.assertEqual(
            ["SD 銷售配銷", "MM 物料管理", "PP 生產規劃", "FI 財務會計", "CO 成本控制"],
            modules,
        )

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
            css_declarations(css_block(keyframes, "0%, 100%")),
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

    def test_raised_keybar_style_exists(self):
        match = re.search(r"\.keybar\.raised\s*\{([^}]*)\}", self.source)
        self.assertIsNotNone(match)
        self.assertRegex(match.group(1), r"bottom\s*:\s*(?:[89]\d|1\d\d)px")

    def test_page_19_and_page_21_keybars_are_raised(self):
        for section_id in ["s20", "s22"]:
            source = section_source(self.source, section_id)
            self.assertIn('class="keybar raised"', source)

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
