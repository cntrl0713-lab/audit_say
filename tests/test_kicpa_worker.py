"""Offline tests. All board responses and recipients are explicitly synthetic."""

from __future__ import annotations

import copy
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import kicpa_scraper
from kicpa_jobs.adapters import (AdapterError, firm_index, next_page, parse_snapshot,
                                 source_url, validate_config)
from kicpa_jobs.providers import (DeliveryResult, DisabledProvider, FakeProvider,
                                  configured_provider, deliver_one, deliver_pending)
from kicpa_jobs.worker import (BoardClient, BoardPage, NetworkError, OutsideWindow, Response,
                               Store, collect, within_scrape_window)

FIXTURES = ROOT / "tests" / "fixtures" / "kicpa-jobs"
CONFIG_FILE = FIXTURES / "synthetic-config.json"
CONFIG = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
HTML = (FIXTURES / "synthetic-trainee.html").read_text(encoding="utf-8")
JSON = (FIXTURES / "synthetic-cpa.json").read_text(encoding="utf-8")
FIRMS = [{"firm_id": 1, "firm_name": "가상회계법인", "alias": ["가상", "공동별칭"]},
         {"firm_id": 2, "firm_name": "다른회계법인", "alias": ["공동별칭"]}]


def kst(value: str) -> datetime:
    return datetime.fromisoformat("2026-09-09T" + value + "+09:00")


def response(status: int = 200, body: str = "ok", **headers) -> Response:
    return Response(status, body.encode(), headers)


class WindowTests(unittest.TestCase):
    def test_boundaries_and_timezone_conversion(self):
        cases = {"08:29:59": False, "08:30:00": True, "18:29:59": True, "18:30:00": False,
                 "00:00:00": False, "23:59:59": False}
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(within_scrape_window(kst(value)), expected)
                self.assertEqual(within_scrape_window(kst(value).astimezone(timezone.utc)), expected)
        with self.assertRaises(ValueError):
            within_scrape_window(datetime(2026, 9, 9, 12))

    def test_outside_window_cannot_make_initial_request(self):
        transport = Mock()
        client = BoardClient(transport, clock=lambda: kst("22:00:00"))
        with self.assertRaises(OutsideWindow):
            client.fetch("https://www.kicpa.or.kr/synthetic")
        transport.request.assert_not_called()

    def test_retry_checks_window_again(self):
        transport = Mock()
        transport.request.side_effect = NetworkError("transport_failed")
        times = iter([kst("18:29:59"), kst("18:30:00")])
        client = BoardClient(transport, clock=lambda: next(times), sleep=Mock())
        with self.assertRaises(OutsideWindow):
            client.fetch("https://www.kicpa.or.kr/synthetic")
        self.assertEqual(transport.request.call_count, 1)

    def test_redirect_checks_window_again(self):
        transport = Mock()
        transport.request.return_value = response(302, location="/synthetic/redirected")
        times = iter([kst("18:29:59"), kst("18:30:00")])
        client = BoardClient(transport, clock=lambda: next(times))
        with self.assertRaises(OutsideWindow):
            client.fetch("https://www.kicpa.or.kr/synthetic")
        self.assertEqual(transport.request.call_count, 1)

    def test_http_retries_are_bounded_and_success_decodes(self):
        transport = Mock()
        transport.request.side_effect = [response(503), response(429), response(200, "가상 응답")]
        client = BoardClient(transport, clock=lambda: kst("09:00:00"), sleep=Mock())
        self.assertEqual(client.fetch("https://www.kicpa.or.kr/synthetic"),
                         BoardPage("가상 응답", "https://www.kicpa.or.kr/synthetic"))
        self.assertEqual(transport.request.call_count, 3)

    def test_foreign_redirect_rejected_without_request(self):
        transport = Mock()
        transport.request.return_value = response(302, location="https://example.org/other")
        with self.assertRaises(AdapterError):
            BoardClient(transport, clock=lambda: kst("09:00:00")).fetch("https://www.kicpa.or.kr/synthetic")
        self.assertEqual(transport.request.call_count, 1)


class AdapterTests(unittest.TestCase):
    def test_synthetic_config_is_explicitly_not_live(self):
        validate_config(CONFIG)
        with self.assertRaisesRegex(AdapterError, "synthetic_config_not_for_live"):
            validate_config(CONFIG, live=True)

    def test_trainee_keeps_regular_posts_without_title_keyword_and_excludes_pinned(self):
        jobs = parse_snapshot(HTML, "trainee_cpa", CONFIG, firms=firm_index(FIRMS))
        self.assertEqual([job["id"] for job in jobs], ["101", "102"])
        self.assertEqual(jobs[0]["title"], "가상 회계법인 채용")
        self.assertEqual(jobs[0]["firm_id"], 1)
        self.assertIsNone(jobs[1]["firm_id"])
        self.assertEqual(set(jobs[0]), {"id", "board", "title", "company", "posted_at", "source_url", "firm_id"})

    def test_raw_body_contact_email_deadline_and_attachments_are_not_extracted(self):
        allowed_fields = {"id", "board", "title", "company", "posted_at", "source_url", "firm_id"}
        for board, content in [("trainee_cpa", HTML), ("cpa", JSON)]:
            with self.subTest(board=board):
                self.assertIn("SYNTHETIC_EXCLUDED_BODY", content)
                self.assertIn("fixture-only@example.invalid", content)
                jobs = parse_snapshot(content, board, CONFIG)
                self.assertTrue(jobs)
                for job in jobs:
                    self.assertEqual(set(job), allowed_fields)
                serialized = json.dumps(jobs)
                self.assertNotIn("SYNTHETIC_EXCLUDED_", serialized)
                self.assertNotIn("fixture-only@example.invalid", serialized)

    def test_additional_field_mappings_fail_before_any_field_is_extracted(self):
        for board, content in [("trainee_cpa", HTML), ("cpa", JSON)]:
            for extra_field in ["deadline", "body", "contact", "email", "attachments"]:
                with self.subTest(board=board, extra_field=extra_field):
                    config = copy.deepcopy(CONFIG)
                    config["boards"][board]["fields"][extra_field] = (
                        {"selector": ".synthetic-" + extra_field} if board == "trainee_cpa" else extra_field)
                    with self.assertRaisesRegex(AdapterError, "field_mappings_must_match_minimal_scope"):
                        validate_config(config)
                    with patch("kicpa_jobs.adapters._html_field") as html_field, \
                            patch("kicpa_jobs.adapters._path") as json_field, \
                            self.assertRaisesRegex(AdapterError, "field_mappings_must_match_minimal_scope"):
                        parse_snapshot(content, board, config)
                    html_field.assert_not_called()
                    json_field.assert_not_called()
        config = copy.deepcopy(CONFIG)
        del config["boards"]["cpa"]["fields"]["company"]
        with self.assertRaisesRegex(AdapterError, "field_mappings_must_match_minimal_scope"):
            validate_config(config)

    def test_cpa_keywords_and_stable_composite_identity(self):
        jobs = parse_snapshot(JSON, "cpa", CONFIG, firms=firm_index(FIRMS))
        self.assertEqual([job["id"] for job in jobs], ["101", "102"])
        trainee = parse_snapshot(HTML, "trainee_cpa", CONFIG)[0]
        self.assertEqual(trainee["id"], jobs[0]["id"])
        self.assertNotEqual((trainee["board"], trainee["id"]), (jobs[0]["board"], jobs[0]["id"]))
        self.assertIsNone(jobs[1]["firm_id"])

    def test_exact_company_matching_and_ambiguity(self):
        index = firm_index(FIRMS)
        self.assertEqual(index["가상회계법인"], 1)
        self.assertEqual(index["가상"], 1)
        self.assertIsNone(index["공동별칭"])
        self.assertNotIn("가상회계법인서울지점", index)
        spaced = HTML.replace("가상회계법인", "가상 회계법인")
        self.assertEqual(parse_snapshot(spaced, "trainee_cpa", CONFIG, firms=index)[0]["firm_id"], 1)

    def test_changed_or_login_html_cannot_silently_become_empty_snapshot(self):
        with self.assertRaisesRegex(AdapterError, "board_structure_changed"):
            parse_snapshot("<html><form>로그인</form></html>", "trainee_cpa", CONFIG)
        empty = '<p class="synthetic-empty">No synthetic posts</p>'
        self.assertEqual(parse_snapshot(empty, "trainee_cpa", CONFIG), [])

    def test_changed_fields_and_bad_date_fail_closed(self):
        for content in [HTML.replace('data-synthetic-id="101"', 'data-other="101"'),
                        HTML.replace('datetime="2026-09-09"', 'datetime="09-09"')]:
            with self.assertRaises(AdapterError):
                parse_snapshot(content, "trainee_cpa", CONFIG)

    def test_post_url_must_be_safe_kicpa_https(self):
        for url in ["javascript:openPost(1)", "https://www.kicpa.or.kr.evil.test/x",
                    "http://www.kicpa.or.kr/x", "https://user@www.kicpa.or.kr/x", ""]:
            with self.subTest(url=url), self.assertRaises(AdapterError):
                source_url(url, CONFIG["boards"]["cpa"]["urls"][0])

    def test_exact_duplicate_deduplicated_conflicting_duplicate_fails(self):
        payload = json.loads(JSON)
        payload["synthetic_posts"].append(copy.deepcopy(payload["synthetic_posts"][1]))
        self.assertEqual(len(parse_snapshot(json.dumps(payload), "cpa", CONFIG)), 2)
        payload["synthetic_posts"][-1]["title"] = "다른 신입 채용"
        with self.assertRaisesRegex(AdapterError, "conflicting_duplicate_post"):
            parse_snapshot(json.dumps(payload), "cpa", CONFIG)

    def test_explicit_pagination_end_required(self):
        item = CONFIG["boards"]["trainee_cpa"]
        self.assertIsNone(next_page(HTML, item, item["urls"][0]))
        with self.assertRaisesRegex(AdapterError, "pagination_structure_changed"):
            next_page(HTML.replace('class="synthetic-end"', 'class="unexpected"'), item, item["urls"][0])
        json_item = CONFIG["boards"]["cpa"]
        self.assertIsNone(next_page(JSON, json_item, json_item["urls"][0]))


class CollectionTests(unittest.TestCase):
    def setUp(self):
        self.store = Mock()
        self.store.firms.return_value = FIRMS
        self.store.ingest.return_value = {"inserted": 2, "queued": 0, "baseline": True}

    def test_complete_baseline_delegated_to_atomic_rpc_without_claiming(self):
        client = Mock()
        client.fetch.side_effect = [BoardPage(HTML, CONFIG["boards"]["trainee_cpa"]["urls"][0]),
                                    BoardPage(JSON, CONFIG["boards"]["cpa"]["urls"][0])]
        summary = collect(CONFIG, client, self.store)
        self.assertEqual(self.store.ingest.call_count, 2)
        self.assertTrue(summary["trainee_cpa"]["baseline"])
        self.assertEqual(summary["trainee_cpa"]["queued"], 0)
        self.store.claim.assert_not_called()
        board, jobs = self.store.ingest.call_args_list[0].args
        self.assertEqual(board, "trainee_cpa")
        self.assertEqual(jobs[0]["firm_id"], 1)

    def test_follows_next_page_before_ingestion(self):
        page1 = HTML.replace('<span class="synthetic-end">SYNTHETIC end of pagination</span>',
                             '<a class="synthetic-next" href="?page=2">Next</a>')
        page2 = HTML.replace('data-synthetic-id="101"', 'data-synthetic-id="201"').replace(
            'data-synthetic-id="102"', 'data-synthetic-id="202"')
        client = Mock()
        client.fetch.side_effect = [BoardPage(page1, CONFIG["boards"]["trainee_cpa"]["urls"][0]),
                                    BoardPage(page2, CONFIG["boards"]["trainee_cpa"]["urls"][0] + "?page=2"),
                                    BoardPage(JSON, CONFIG["boards"]["cpa"]["urls"][0])]
        collect(CONFIG, client, self.store)
        self.assertEqual(len(self.store.ingest.call_args_list[0].args[1]), 4)
        self.assertIn("?page=2", client.fetch.call_args_list[1].args[0])

    def test_page_cap_never_ingests_partial_baseline(self):
        config = copy.deepcopy(CONFIG)
        config["boards"]["trainee_cpa"]["pagination"]["max_pages"] = 1
        page1 = HTML.replace('<span class="synthetic-end">SYNTHETIC end of pagination</span>',
                             '<a class="synthetic-next" href="?page=2">Next</a>')
        client = Mock()
        client.fetch.return_value = BoardPage(page1, CONFIG["boards"]["trainee_cpa"]["urls"][0])
        with self.assertRaisesRegex(AdapterError, "snapshot_incomplete_page_limit"):
            collect(config, client, self.store)
        self.store.ingest.assert_not_called()

    def test_pagination_cycle_never_ingests(self):
        page1 = HTML.replace('<span class="synthetic-end">SYNTHETIC end of pagination</span>',
                             '<a class="synthetic-next" href="/synthetic/trainee">Next</a>')
        client = Mock()
        client.fetch.return_value = BoardPage(page1, CONFIG["boards"]["trainee_cpa"]["urls"][0])
        with self.assertRaisesRegex(AdapterError, "pagination_cycle"):
            collect(CONFIG, client, self.store)
        self.store.ingest.assert_not_called()

    def test_redirect_destination_resolves_post_and_next_links_without_double_counting_page(self):
        config = copy.deepcopy(CONFIG)
        config["boards"]["trainee_cpa"]["urls"] = ["https://www.kicpa.or.kr/a/list"]
        config["boards"]["trainee_cpa"]["pagination"]["max_pages"] = 2
        first_page = HTML.replace('/synthetic/post?id=101', 'post/101').replace(
            '/synthetic/post?id=102', 'post/102').replace(
            '<span class="synthetic-end">SYNTHETIC end of pagination</span>',
            '<a class="synthetic-next" href="next?page=2">Next</a>')
        last_page = '<p class="synthetic-empty">No posts</p><span class="synthetic-end">End</span>'
        transport = Mock()
        transport.request.side_effect = [response(302, location="/b/list"), response(200, first_page),
                                         response(200, last_page), response(200, JSON)]
        collect(config, BoardClient(transport, clock=lambda: kst("09:00:00")), self.store)
        requested_urls = [call.args[1] for call in transport.request.call_args_list]
        self.assertEqual(requested_urls[:3], ["https://www.kicpa.or.kr/a/list",
                                             "https://www.kicpa.or.kr/b/list",
                                             "https://www.kicpa.or.kr/b/next?page=2"])
        jobs = self.store.ingest.call_args_list[0].args[1]
        self.assertEqual([job["source_url"] for job in jobs], ["https://www.kicpa.or.kr/b/post/101",
                                                              "https://www.kicpa.or.kr/b/post/102"])
        self.assertEqual(self.store.ingest.call_count, 2)

    def test_pagination_alias_redirecting_to_visited_final_url_fails_before_ingestion(self):
        config = copy.deepcopy(CONFIG)
        config["boards"]["trainee_cpa"]["urls"] = ["https://www.kicpa.or.kr/a/list"]
        page = HTML.replace('<span class="synthetic-end">SYNTHETIC end of pagination</span>',
                            '<a class="synthetic-next" href="alias">Next</a>')
        transport = Mock()
        transport.request.side_effect = [response(302, location="/b/list"), response(200, page),
                                         response(302, location="/b/list"), response(200, page)]
        with self.assertRaisesRegex(AdapterError, "pagination_cycle"):
            collect(config, BoardClient(transport, clock=lambda: kst("09:00:00")), self.store)
        self.store.ingest.assert_not_called()
        self.assertEqual(transport.request.call_count, 4)

    def test_store_preserves_board_identity_and_accepted_provider_id(self):
        transport = Mock()
        transport.request.return_value = response(200, '{"inserted":1,"queued":0,"baseline":true}')
        store = Store(transport, "https://database.example", "synthetic-service-key")
        job = parse_snapshot(HTML, "trainee_cpa", CONFIG)[0]
        store.ingest("trainee_cpa", [job])
        payload = json.loads(transport.request.call_args.kwargs["data"])
        self.assertEqual(payload["p_board"], "trainee_cpa")
        self.assertEqual(payload["p_jobs"][0]["id"], "101")
        transport.request.return_value = response(200, "true")
        store.finish({"id": "test-delivery", "attempts": 3}, "accepted", provider_message_id="test-provider-id")
        payload = json.loads(transport.request.call_args.kwargs["data"])
        self.assertEqual(payload["p_status"], "accepted")
        self.assertEqual(payload["p_provider_message_id"], "test-provider-id")
        self.assertEqual(payload["p_retry_seconds"], 1200)

    def test_store_reads_only_minimal_announcement_fields_and_internal_identity(self):
        transport = Mock()
        transport.request.return_value = response(200, "[]")
        store = Store(transport, "https://database.example", "synthetic-service-key")
        store.job("trainee_cpa", "101")
        query = parse_qs(urlsplit(transport.request.call_args.args[1]).query)
        self.assertEqual(set(query["select"][0].split(",")),
                         {"board", "id", "title", "company", "posted_at", "source_url", "firm_id", "created_at"})


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.delivery = {"id": "synthetic-delivery", "job_board": "trainee_cpa", "job_id": "101",
                         "subscriber_id": "synthetic-subscriber", "attempts": 1}
        self.job = parse_snapshot(HTML, "trainee_cpa", CONFIG)[0] | {"created_at": "2026-09-09T09:00:00+09:00"}
        self.subscriber = {"id": "synthetic-subscriber", "is_active": True,
                           "boards": ["trainee_cpa", "cpa"], "consent_version": "2026-09-09-v1",
                           "consented_at": "2026-09-09T08:30:00+09:00",
                           "notifications_since": "2026-09-09T08:30:00+09:00",
                           "phone_e164": "+821000000000", "phone_verified_at": "2026-09-09T08:30:00+09:00"}
        self.store = Mock()
        self.store.claim.side_effect = [self.delivery, None]
        self.store.job.return_value = self.job
        self.store.subscriber.return_value = self.subscriber

    def test_disabled_provider_never_touches_queue_even_when_environment_enabled(self):
        with patch.dict(os.environ, {"KICPA_NOTIFICATIONS_ENABLED": "true", "KICPA_PROVIDER": "fake"}):
            provider = configured_provider()
        self.assertIsInstance(provider, DisabledProvider)
        self.assertEqual(deliver_pending(self.store, provider, ""), {"disabled": 1})
        self.assertEqual(deliver_one(self.store, provider, self.delivery, ""), "disabled")
        self.assertEqual(self.store.mock_calls, [])

    def test_acceptance_is_distinct_from_final_delivery(self):
        provider = FakeProvider([DeliveryResult("accepted", "synthetic-provider-id")])
        counts = deliver_pending(self.store, provider, "https://audit-say.example")
        self.assertEqual(counts, {"accepted": 1})
        self.store.finish.assert_called_once_with(self.delivery, "accepted", None, "synthetic-provider-id")
        self.assertEqual(provider.notifications[0].idempotency_key, self.delivery["id"])
        self.assertEqual(provider.notifications[0].app_url, "https://audit-say.example/jobs")
        self.assertEqual(provider.notifications[0].settings_url, "https://audit-say.example/settings")
        self.assertEqual(provider.notifications[0].board, "trainee_cpa")
        self.assertEqual(provider.notifications[0].posted_at, "2026-09-09")
        self.assertEqual(provider.notifications[0].requested_boards, ("trainee_cpa", "cpa"))
        self.assertEqual(provider.notifications[0].requested_conditions,
                         "수습CPA 게시판의 전체 공고 / CPA 게시판의 수습·신입 공고")
        self.assertNotIn(self.subscriber["phone_e164"], repr(provider.notifications[0]))

    def test_notification_excludes_legacy_extra_fields_and_keeps_direct_source_link(self):
        self.store.job.return_value = self.job | {
            "deadline": "SYNTHETIC_EXCLUDED_DEADLINE", "body": "SYNTHETIC_EXCLUDED_BODY",
            "contact": "SYNTHETIC_EXCLUDED_CONTACT", "email": "fixture-only@example.invalid",
            "attachments": ["SYNTHETIC_EXCLUDED_ATTACHMENT"],
        }
        provider = FakeProvider([DeliveryResult("accepted", "synthetic-provider-id")])
        deliver_one(self.store, provider, self.delivery, "https://audit-say.example")
        notification = asdict(provider.notifications[0])
        self.assertEqual(notification["source_url"], self.job["source_url"])
        self.assertFalse({"deadline", "body", "contact", "email", "attachments"} & set(notification))
        self.assertNotIn("SYNTHETIC_EXCLUDED_", json.dumps(notification))
        self.assertNotIn("fixture-only@example.invalid", json.dumps(notification))

    def test_confirmed_delivery_uses_sent_state(self):
        provider = FakeProvider([DeliveryResult("sent", "synthetic-provider-id")])
        self.assertEqual(deliver_one(self.store, provider, self.delivery, "https://audit-say.example"), "sent")
        self.store.finish.assert_called_once_with(self.delivery, "sent", None, "synthetic-provider-id")

    def test_ambiguous_send_records_uncertain_and_never_retries_in_process(self):
        provider = FakeProvider([TimeoutError("must not leak recipient or credentials")])
        self.assertEqual(deliver_pending(self.store, provider, "https://audit-say.example"), {"uncertain": 1})
        self.assertEqual(len(provider.notifications), 1)
        self.store.finish.assert_called_once_with(self.delivery, "uncertain", "provider_outcome_uncertain")

    def test_explicit_rejection_can_use_bounded_db_retry(self):
        provider = FakeProvider([DeliveryResult("rejected")])
        self.assertEqual(deliver_one(self.store, provider, self.delivery, "https://audit-say.example"), "failed")
        self.store.finish.assert_called_once_with(self.delivery, "failed", "provider_rejected")

    def test_recipient_eligibility_rechecked_after_claim(self):
        invalid_states = [dict(is_active=False), dict(phone_verified_at=None), dict(phone_e164=None),
                          dict(consent_version="obsolete-consent"), dict(consented_at=None), dict(boards=["cpa"]),
                          dict(notifications_since="2026-09-09T10:00:00+09:00")]
        for overrides in invalid_states:
            with self.subTest(overrides=overrides):
                self.store.subscriber.return_value = self.subscriber | overrides
                provider = FakeProvider([DeliveryResult("sent")])
                self.assertEqual(deliver_one(self.store, provider, self.delivery, "https://audit-say.example"), "cancelled")
                self.assertEqual(provider.notifications, [])

    def test_accepted_result_requires_correlatable_provider_id(self):
        with self.assertRaisesRegex(ValueError, "accepted_requires_provider_message_id"):
            DeliveryResult("accepted")
        with self.assertRaisesRegex(ValueError, "invalid_provider_message_id"):
            DeliveryResult("accepted", "unsafe\nprovider")


class CliTests(unittest.TestCase):
    def test_offline_fixture_never_constructs_network_or_store(self):
        for board, filename in [("trainee_cpa", "synthetic-trainee.html"), ("cpa", "synthetic-cpa.json")]:
            with self.subTest(board=board), patch("kicpa_scraper.Transport") as transport, \
                    patch("kicpa_scraper.Store") as store:
                output = io.StringIO()
                with redirect_stdout(output):
                    code = kicpa_scraper.main(["--config", str(CONFIG_FILE), "--fixture",
                                              str(FIXTURES / filename), "--board", board])
                self.assertEqual(code, 0)
                transport.assert_not_called()
                store.assert_not_called()
                result = json.loads(output.getvalue())
                self.assertEqual(result["external_requests"], 0)
                self.assertEqual(set(result["jobs"][0]),
                                 {"id", "board", "title", "company", "posted_at", "source_url", "firm_id"})
                self.assertNotIn("SYNTHETIC_EXCLUDED_", output.getvalue())
                self.assertNotIn("fixture-only@example.invalid", output.getvalue())

    def test_dry_run_without_fixture_is_also_offline(self):
        with patch("kicpa_scraper.Transport") as transport, redirect_stdout(io.StringIO()):
            self.assertEqual(kicpa_scraper.main(["--config", str(CONFIG_FILE), "--dry-run"]), 0)
        transport.assert_not_called()

    def test_manual_live_run_off_hours_skips_before_config_or_network(self):
        with patch("kicpa_scraper.utcnow", return_value=kst("22:00:00")), \
                patch("kicpa_scraper.Transport") as transport, redirect_stdout(io.StringIO()):
            self.assertEqual(kicpa_scraper.main([]), 0)
        transport.assert_not_called()

    def test_live_unverified_layout_fails_without_network(self):
        with patch("kicpa_scraper.utcnow", return_value=kst("09:00:00")), \
                patch.dict(os.environ, {"KICPA_BOARD_LAYOUT_VERIFIED": "false"}), \
                patch("kicpa_scraper.Transport") as transport, redirect_stdout(io.StringIO()):
            self.assertEqual(kicpa_scraper.main(["--config", str(CONFIG_FILE)]), 1)
        transport.assert_not_called()

    def test_unknown_exception_details_are_never_logged(self):
        output = io.StringIO()
        with patch("kicpa_scraper.validate_config", side_effect=RuntimeError("SECRET must not log")), \
                redirect_stdout(output):
            self.assertEqual(kicpa_scraper.main(["--config", str(CONFIG_FILE), "--dry-run"]), 1)
        self.assertNotIn("SECRET", output.getvalue())


if __name__ == "__main__":
    unittest.main()
