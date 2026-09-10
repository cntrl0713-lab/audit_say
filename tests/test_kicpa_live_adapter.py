"""Offline regression tests against sanitized, structurally observed KICPA pages."""

from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from kicpa_jobs.adapters import (AdapterError, firm_index, next_page, parse_snapshot,
                                 snapshot_metadata, validate_config)

CONFIG = json.loads((ROOT / "scripts/kicpa_jobs/live-config.json").read_text(encoding="utf-8"))
FIXTURES = ROOT / "tests/fixtures/kicpa-jobs/live-layout"
TRAINEE = (FIXTURES / "trainee-page1.html").read_text(encoding="utf-8")
CPA_FIRST = (FIXTURES / "cpa-page1.html").read_text(encoding="utf-8")
CPA_LAST = (FIXTURES / "cpa-page2.html").read_text(encoding="utf-8")


def base_url(board: str, page: int = 1) -> str:
    return CONFIG["boards"][board]["urls"][0].replace("page=1", "page=" + str(page))


def edit_first_row(content: str, mutate) -> str:
    soup = BeautifulSoup(content, "html.parser")
    mutate(soup.select_one("table.table_st02 tbody tr"))
    return str(soup)


class LiveAdapterTests(unittest.TestCase):
    def test_verified_config_validates_with_exact_minimal_mappings(self):
        validate_config(CONFIG, live=True)
        for item in CONFIG["boards"].values():
            self.assertEqual(set(item["fields"]), {"id", "title", "company", "posted_at", "source_url"})

    def test_live_config_cannot_add_or_repurpose_fields(self):
        for field in ["deadline", "body", "email", "contact", "attachments"]:
            config = copy.deepcopy(CONFIG)
            config["boards"]["trainee_cpa"]["fields"][field] = "td[3]"
            with self.subTest(field=field), self.assertRaises(AdapterError):
                validate_config(config, live=True)
        config = copy.deepcopy(CONFIG)
        config["boards"]["trainee_cpa"]["fields"]["company"] = "td[3]"
        with self.assertRaisesRegex(AdapterError, "live_field_mappings_changed"):
            parse_snapshot(TRAINEE, "trainee_cpa", config)

    def test_observed_three_page_structure_produces_only_allowed_fields(self):
        fixtures = [("trainee_cpa", TRAINEE, 1, 40), ("cpa", CPA_FIRST, 1, 67), ("cpa", CPA_LAST, 2, 20)]
        expected_fields = {"board", "id", "title", "company", "posted_at", "source_url", "firm_id"}
        for board, content, page, expected_count in fixtures:
            with self.subTest(board=board, page=page):
                jobs = parse_snapshot(content, board, CONFIG, base_url=base_url(board, page))
                self.assertEqual(len(jobs), expected_count)
                self.assertTrue(all(set(job) == expected_fields for job in jobs))
                self.assertTrue(all(job["posted_at"] == "2026-01-01" for job in jobs))
                self.assertNotIn("SYNTHETIC_EXCLUDED_", json.dumps(jobs))
                self.assertNotIn("fixture-only@example.invalid", json.dumps(jobs))

    def test_source_links_use_verified_detail_id_without_session_or_network(self):
        for board, content in [("trainee_cpa", TRAINEE), ("cpa", CPA_FIRST)]:
            jobs = parse_snapshot(content, board, CONFIG)
            for job in jobs:
                parsed = urlsplit(job["source_url"])
                self.assertEqual(parsed.scheme, "https")
                self.assertEqual(parsed.hostname, "www.kicpa.or.kr")
                self.assertTrue(parsed.path.endswith("/detail.face"))
                self.assertEqual(parse_qs(parsed.query), {"ijIdNum": [job["id"]]})
                self.assertNotIn("jsessionid", job["source_url"])

    def test_metadata_preserves_all_regular_rows_before_title_filter(self):
        first = snapshot_metadata(CPA_FIRST, CONFIG["boards"]["cpa"], base_url("cpa"))
        last = snapshot_metadata(CPA_LAST, CONFIG["boards"]["cpa"], base_url("cpa", 2))
        self.assertEqual((first["page"], first["total_pages"], first["total_rows"], first["list_count"]), (1, 2, 130, 100))
        self.assertEqual(first["row_count"], 100)
        self.assertEqual(last["row_count"], 30)
        self.assertEqual(first["ordinal_numbers"], tuple(range(130, 30, -1)))
        self.assertEqual(last["ordinal_numbers"], tuple(range(30, 0, -1)))
        all_ids = first["regular_ids"] + last["regular_ids"]
        self.assertEqual(len(set(all_ids)), 130)
        self.assertTrue(all(len(identifier) == 13 and identifier.isdigit() for identifier in all_ids))

    def test_next_page_uses_verified_counter_and_preserves_board_filter(self):
        item = CONFIG["boards"]["cpa"]
        url = next_page(CPA_FIRST, item, base_url("cpa"))
        self.assertEqual(parse_qs(urlsplit(url).query), {"ijJobSep": ["1"], "listCnt": ["100"], "page": ["2"]})
        self.assertNotIn("jsessionid", url)
        self.assertIsNone(next_page(CPA_LAST, item, base_url("cpa", 2)))
        self.assertIsNone(next_page(TRAINEE, CONFIG["boards"]["trainee_cpa"], base_url("trainee_cpa")))

    def test_company_exact_match_is_preserved(self):
        index = firm_index([{"firm_id": 9, "firm_name": "합성회계법인", "alias": []}])
        jobs = parse_snapshot(TRAINEE, "trainee_cpa", CONFIG, firms=index)
        self.assertTrue(any(job["firm_id"] == 9 for job in jobs))
        self.assertTrue(any(job["firm_id"] is None for job in jobs))
        self.assertTrue(all(job["firm_id"] == 9 for job in jobs if job["company"] == "합성 회계법인"))

    def test_only_observed_empty_state_is_accepted(self):
        for board, filename,columns in [("trainee_cpa", "trainee-empty.html", 8), ("cpa", "cpa-empty.html", 7)]:
            content = (FIXTURES / filename).read_text(encoding="utf-8")
            item = CONFIG["boards"][board]
            self.assertEqual(parse_snapshot(content, board, CONFIG), [])
            meta = snapshot_metadata(content, item, base_url(board))
            self.assertEqual((meta["page"], meta["total_pages"], meta["total_rows"], meta["row_count"]), (1, 0, 0, 0))
            self.assertEqual(meta["regular_ids"], ())
            self.assertIsNone(next_page(content, item, base_url(board)))
            for changed in [content.replace("해당하는 글이 존재하지 않습니다.", "로그인이 필요합니다."),
                            content.replace(f'colspan="{columns}"', 'colspan="99"'),
                            content.replace("fn_setPage(1, 0, 10)", "fn_setPage(1, 1, 10)")]:
                with self.subTest(board=board), self.assertRaises(AdapterError):
                    parse_snapshot(changed, board, CONFIG)

    def test_header_or_column_change_fails_closed(self):
        with self.assertRaisesRegex(AdapterError, "live_table_headers_changed"):
            parse_snapshot(TRAINEE.replace("<th>회사명</th>", "<th>담당자</th>"), "trainee_cpa", CONFIG)
        changed = edit_first_row(TRAINEE, lambda row: row.find_all("td", recursive=False)[2].decompose())
        with self.assertRaisesRegex(AdapterError, "live_row_columns_changed"):
            parse_snapshot(changed, "trainee_cpa", CONFIG)

    def test_unknown_notice_rows_fail_without_guessing_identity(self):
        changed = edit_first_row(TRAINEE, lambda row: setattr(row.td, "string", "공지"))
        with self.assertRaisesRegex(AdapterError, "live_non_regular_row"):
            parse_snapshot(changed, "trainee_cpa", CONFIG)

    def test_missing_row_and_changed_ordinal_fail_closed(self):
        removed = edit_first_row(CPA_FIRST, lambda row: row.decompose())
        with self.assertRaisesRegex(AdapterError, "live_row_count_mismatch"):
            parse_snapshot(removed, "cpa", CONFIG)
        changed = edit_first_row(CPA_FIRST, lambda row: setattr(row.td, "string", "129"))
        with self.assertRaisesRegex(AdapterError, "live_row_order_changed"):
            parse_snapshot(changed, "cpa", CONFIG)

    def test_duplicate_post_ids_fail_before_deduplication(self):
        soup = BeautifulSoup(CPA_FIRST, "html.parser")
        anchors = soup.select("a.subject_title")
        anchors[1]["onclick"] = anchors[0]["onclick"]
        with self.assertRaisesRegex(AdapterError, "live_duplicate_post_identity"):
            parse_snapshot(str(soup), "cpa", CONFIG)

    def test_invalid_company_or_date_even_on_excluded_title_is_rejected(self):
        for column,value,error in [(2,"","live_company_changed"), (2,"123456","live_company_changed"),
                                    (5,"2026.02.30","live_posted_date_changed"), (5,"01.01","live_posted_date_changed")]:
            def mutate(row):
                row.select_one("a.subject_title").string = "SYNTHETIC 경력만 채용"
                row.find_all("td",recursive=False)[column].string = value
            changed = edit_first_row(CPA_FIRST, mutate)
            with self.subTest(column=column,value=value), self.assertRaisesRegex(AdapterError,error):
                parse_snapshot(changed,"cpa",CONFIG)

    def test_click_id_and_detail_script_changes_fail_closed(self):
        changed = edit_first_row(TRAINEE, lambda row: row.select_one("a.subject_title").__setitem__("onclick", "javascript:fn_detail('short')"))
        with self.assertRaisesRegex(AdapterError,"live_post_identity_changed"):
            parse_snapshot(changed,"trainee_cpa",CONFIG)
        for changed in [TRAINEE.replace('.val(bltnNo)', '.val(otherId)'),
                        TRAINEE.replace('function fn_detail(bltnNo)', 'function fn_detail(newId)')]:
            with self.assertRaisesRegex(AdapterError,"live_detail_script_changed"):
                parse_snapshot(changed,"trainee_cpa",CONFIG)

    def test_wrong_board_detail_form_is_rejected(self):
        changed = TRAINEE.replace('/jobOffrSrchNewGnrl/detail.face;', '/jobOffrSrchGnrl/detail.face;')
        with self.assertRaisesRegex(AdapterError, "live_form_action_changed"):
            parse_snapshot(changed, "trainee_cpa", CONFIG)

    def test_request_hidden_script_and_total_counters_must_agree(self):
        changes = [CPA_FIRST.replace('name="page" value="1"', 'name="page" value="2"'),
                   CPA_FIRST.replace('name="listCnt" value="20"', 'name="listCnt" value="100"'),
                   CPA_FIRST.replace('fn_setPage(1, 2, 10)', 'fn_setPage(1, 3, 10)'),
                   CPA_FIRST.replace('(총 130 건)', '(총 99 건)'),
                   CPA_FIRST.replace('fn_setPage(1, 2, 10)', 'fn_unknownPage(1, 2, 10)')]
        for changed in changes:
            with self.assertRaises(AdapterError):
                parse_snapshot(changed, "cpa", CONFIG)
        with self.assertRaisesRegex(AdapterError, "live_hidden_pagination_changed"):
            parse_snapshot(CPA_FIRST, "cpa", CONFIG, base_url=base_url("cpa", 2))

    def test_query_route_or_start_page_cannot_silently_change_snapshot_scope(self):
        for url in [base_url("cpa") + "&srhKey=unexpected", base_url("cpa").replace("listCnt=100", "listCnt=20"),
                    base_url("cpa").replace("ijJobSep=1", "ijJobSep=2"), base_url("trainee_cpa")]:
            with self.subTest(url=url), self.assertRaises(AdapterError):
                parse_snapshot(CPA_FIRST, "cpa", CONFIG, base_url=url)
        config = copy.deepcopy(CONFIG)
        config["boards"]["cpa"]["urls"][0] = base_url("cpa", 2)
        with self.assertRaisesRegex(AdapterError, "live_snapshot_must_start_at_first_page"):
            validate_config(config)

    def test_snapshot_over_configured_page_cap_is_rejected(self):
        config = copy.deepcopy(CONFIG)
        config["boards"]["cpa"]["pagination"]["max_pages"] = 1
        with self.assertRaisesRegex(AdapterError,"snapshot_incomplete_page_limit"):
            parse_snapshot(CPA_FIRST,"cpa",config)


if __name__ == "__main__":
    unittest.main()
