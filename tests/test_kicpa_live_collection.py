"""Offline collection-contract fixtures; no site, database or message requests."""

from __future__ import annotations

import copy
import json
import sys
import unittest
from contextlib import ExitStack
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from kicpa_jobs.adapters import AdapterError
from kicpa_jobs.worker import BoardClient, BoardPage, OutsideWindow, Response, collect


def board_url(board, page=1):
    return f"https://www.kicpa.or.kr/synthetic/{board}?page={page}"


def document(board="trainee_cpa", page=1, total=3, count=2):
    """Contract data only; the separate adapter tests verify actual HTML parsing."""
    pages = (total + count - 1) // count
    start = total - (page - 1) * count
    ordinals = list(range(start, max(0, start - count), -1))
    ids = [f"{ordinal:013d}" for ordinal in ordinals]
    jobs = [{"board": board, "id": identifier, "title": "가상 신입 채용", "company": "가상회계법인",
             "posted_at": "2026-09-10", "source_url": f"https://www.kicpa.or.kr/synthetic/post/{identifier}",
             "firm_id": None}
            for identifier, ordinal in zip(ids, ordinals)
            if board == "trainee_cpa" or ordinal % 2 == 0]
    return {"metadata": {"page": page, "total_pages": pages, "total_rows": total,
                         "list_count": count, "row_count": len(ids),
                         "regular_ids": ids, "ordinal_numbers": ordinals},
            "jobs": jobs, "next": board_url(board, page + 1) if page < pages else None}


class FullCollectionTests(unittest.TestCase):
    def setUp(self):
        self.config = {"boards": {board: {"format": "kicpa_face_v1", "urls": [board_url(board)],
                                          "pagination": {"max_pages": 20}}
                                  for board in ("trainee_cpa", "cpa")}}
        self.store = Mock()
        self.store.firms.return_value = []
        self.store.ingest.side_effect = lambda board, jobs: {"inserted": len(jobs), "queued": 0, "baseline": True}
        self.client = Mock()
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch("kicpa_jobs.worker.snapshot_metadata",
                                     side_effect=lambda content, *_: json.loads(content)["metadata"]))
        self.stack.enter_context(patch("kicpa_jobs.worker.parse_snapshot",
                                     side_effect=lambda content, *_args, **_kwargs: json.loads(content)["jobs"]))
        self.stack.enter_context(patch("kicpa_jobs.worker.next_page",
                                     side_effect=lambda content, *_: json.loads(content)["next"]))

    def responses(self, docs):
        self.client.fetch.side_effect = [BoardPage(json.dumps(doc), board_url(board, doc["metadata"]["page"]))
                                         for board, doc in docs]

    def assert_board_rejected(self, first, second, error):
        self.responses([("trainee_cpa", first), ("trainee_cpa", second)])
        with self.assertRaisesRegex(AdapterError, error):
            collect(self.config, self.client, self.store)
        self.store.ingest.assert_not_called()

    def test_complete_scan_counts_unmatched_rows_and_rechecks_only_multipage_head(self):
        first, second = document("cpa"), document("cpa", page=2)
        self.assertEqual(second["jobs"], [])
        self.responses([("trainee_cpa", document(total=1)), ("cpa", first), ("cpa", second), ("cpa", first)])
        summaries = collect(self.config, self.client, self.store)
        self.assertEqual(self.client.fetch.call_count, 4)
        self.assertEqual(self.client.fetch.call_args_list[-1].args[0], board_url("cpa"))
        self.assertEqual(summaries["trainee_cpa"]["fetched_pages"], 1)
        self.assertEqual(summaries["cpa"]["fetched_pages"], 3)
        self.assertEqual(summaries["cpa"]["scanned_rows"], 3)
        self.assertEqual(summaries["cpa"]["matched_jobs"], 1)
        self.assertEqual(len(self.store.ingest.call_args_list[1].args[1]), 1)
        self.store.claim.assert_not_called()

    def test_snapshot_totals_page_size_and_page_count_cannot_change_mid_scan(self):
        for key, value in (("total_rows", 4), ("list_count", 3), ("total_pages", 3)):
            with self.subTest(key=key):
                second = document(page=2)
                second["metadata"][key] = value
                self.assert_board_rejected(document(), second, "snapshot_totals_changed")

    def test_page_sequence_and_unfiltered_ordinals_must_be_complete(self):
        for key, value, error in (("page", 3, "snapshot_page_out_of_order"),
                                  ("ordinal_numbers", [2], "snapshot_ordinal_mismatch"),
                                  ("row_count", 0, "snapshot_row_count_mismatch"),
                                  ("regular_ids", [], "snapshot_row_count_mismatch")):
            with self.subTest(key=key):
                second = document(page=2)
                second["metadata"][key] = value
                self.assert_board_rejected(document(), second, error)

    def test_duplicate_unmatched_id_is_not_hidden_by_title_filter(self):
        first, second = document(), document(page=2)
        first["jobs"] = second["jobs"] = []
        second["metadata"]["regular_ids"][0] = first["metadata"]["regular_ids"][0]
        self.assert_board_rejected(first, second, "snapshot_duplicate_post")

    def test_early_pagination_end_never_initializes_partial_baseline(self):
        first = document()
        first["next"] = None
        self.responses([("trainee_cpa", first)])
        with self.assertRaisesRegex(AdapterError, "snapshot_incomplete"):
            collect(self.config, self.client, self.store)
        self.store.ingest.assert_not_called()
        self.assertEqual(self.client.fetch.call_count, 1)

    def test_changed_head_identity_or_summary_after_last_page_rejects_whole_board(self):
        for field in ("regular_ids", "title", "company", "posted_at", "source_url"):
            with self.subTest(field=field):
                first = document()
                changed = copy.deepcopy(first)
                if field == "regular_ids":
                    changed["metadata"][field][0] = "9999999999999"
                else:
                    changed["jobs"][0][field] = "changed synthetic summary"
                self.responses([("trainee_cpa", first), ("trainee_cpa", document(page=2)), ("trainee_cpa", changed)])
                with self.assertRaisesRegex(AdapterError, "snapshot_head_changed"):
                    collect(self.config, self.client, self.store)
                self.store.ingest.assert_not_called()

    def test_recheck_failure_leaves_ingestion_unattempted(self):
        self.responses([("trainee_cpa", document()), ("trainee_cpa", document(page=2))])
        replies = list(self.client.fetch.side_effect)
        self.client.fetch.side_effect = replies + [OutsideWindow("outside_kst_scrape_window")]
        with self.assertRaises(OutsideWindow):
            collect(self.config, self.client, self.store)
        self.store.ingest.assert_not_called()

    def test_verified_empty_board_is_complete_and_does_not_need_head_recheck(self):
        self.responses([("trainee_cpa", document(total=0)), ("cpa", document("cpa", total=0))])
        summaries = collect(self.config, self.client, self.store)
        self.assertEqual(self.client.fetch.call_count, 2)
        self.assertEqual(summaries["trainee_cpa"]["scanned_rows"], 0)
        self.assertEqual(summaries["cpa"]["matched_jobs"], 0)
        self.assertEqual(self.store.ingest.call_args_list[0].args[1], [])


class FakeClock:
    def __init__(self, time="09:00:00"):
        self.wall = datetime.fromisoformat("2026-09-10T" + time + "+09:00")
        self.elapsed = 0.0
        self.sleeps = []

    def now(self):
        return self.wall + timedelta(seconds=self.elapsed)

    def monotonic(self):
        return self.elapsed

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.elapsed += seconds


class RequestSpacingTests(unittest.TestCase):
    def client(self, clock, responses):
        self.starts = []
        self.transport = Mock()
        replies = iter(responses)

        def request(*_args, **_kwargs):
            self.starts.append(clock.monotonic())
            return next(replies)

        self.transport.request.side_effect = request
        return BoardClient(self.transport, clock=clock.now, sleep=clock.sleep, monotonic=clock.monotonic)

    def test_default_spacing_applies_across_fetches_and_redirects(self):
        clock = FakeClock()
        client = self.client(clock, [Response(200, b"first", {}), Response(302, b"", {"location": "/synthetic/final"}),
                                     Response(200, b"second", {})])
        client.fetch(board_url("trainee_cpa"))
        client.fetch(board_url("cpa"))
        self.assertEqual(self.starts, [0.0, 1.0, 2.0])
        self.assertEqual(clock.sleeps, [1.0, 1.0])

    def test_retry_backoff_already_satisfies_minimum_spacing(self):
        clock = FakeClock()
        client = self.client(clock, [Response(503, b"", {}), Response(200, b"ok", {})])
        client.fetch(board_url("trainee_cpa"))
        self.assertEqual(self.starts, [0.0, 2.0])
        self.assertEqual(clock.sleeps, [2])

    def test_window_is_checked_after_spacing_delay_for_next_page_and_redirect(self):
        for redirected in (False, True):
            with self.subTest(redirected=redirected):
                clock = FakeClock("18:29:59.500")
                first = Response(302, b"", {"location": "/synthetic/final"}) if redirected else Response(200, b"ok", {})
                client = self.client(clock, [first])
                with self.assertRaises(OutsideWindow):
                    client.fetch(board_url("trainee_cpa"))
                    client.fetch(board_url("cpa"))
                self.assertEqual(self.starts, [0.0])
                self.assertEqual(self.transport.request.call_count, 1)


if __name__ == "__main__":
    unittest.main()
