"""Guarded collection and transactional outbox storage; no messaging vendor enabled."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zoneinfo import ZoneInfo

from .adapters import (BOARD_URLS, AdapterError, firm_index, next_page, parse_snapshot,
                       snapshot_metadata, source_url)

KST = ZoneInfo("Asia/Seoul")
UTC = timezone.utc
MAX_BODY_BYTES = 2_000_000
MIN_REQUEST_INTERVAL_SECONDS = 1.0
SUBSCRIBERS = "cpa_kicpa_jobs_subscribers"
JOBS = "cpa_kicpa_jobs"


class WorkerError(RuntimeError):
    """Fixed error code suitable for public runner logs."""


class OutsideWindow(WorkerError):
    pass


class NetworkError(WorkerError):
    pass


def utcnow() -> datetime:
    return datetime.now(UTC)


def within_scrape_window(now: datetime) -> bool:
    if now.tzinfo is None:
        raise ValueError("timezone_aware_clock_required")
    local = now.astimezone(KST)
    minute = local.hour * 60 + local.minute
    return 8 * 60 + 30 <= minute < 18 * 60 + 30


def require_scrape_window(now: datetime) -> None:
    if not within_scrape_window(now):
        raise OutsideWindow("outside_kst_scrape_window")


def _date(value: str | None) -> datetime:
    if not value:
        return datetime.min.replace(tzinfo=UTC)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed
    except ValueError as error:
        raise WorkerError("invalid_timestamp") from error


@dataclass
class Response:
    status: int
    body: bytes
    headers: dict[str, str]

    def json(self):
        try:
            return json.loads(self.body)
        except (UnicodeDecodeError, ValueError) as error:
            raise WorkerError("invalid_json_response") from error


@dataclass(frozen=True)
class BoardPage:
    content: str
    final_url: str


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Transport:
    """No implicit retries or redirects, including for non-idempotent sends."""

    def __init__(self):
        self.opener = build_opener(_NoRedirect())

    def request(self, method: str, url: str, *, headers: dict | None = None,
                data: bytes | None = None) -> Response:
        request = Request(url, data=data, headers=headers or {}, method=method)
        try:
            try:
                result = self.opener.open(request, timeout=20)
            except HTTPError as error:
                result = error
            with result:
                body = result.read(MAX_BODY_BYTES + 1)
                if len(body) > MAX_BODY_BYTES:
                    raise NetworkError("response_too_large")
                return Response(result.code, body, {k.lower(): v for k, v in result.headers.items()})
        except (OSError, URLError) as error:
            # Exceptions may embed URLs, headers, tokens, or server response text.
            raise NetworkError("transport_failed") from error


class BoardClient:
    def __init__(self, transport, clock: Callable = utcnow, sleep: Callable = time.sleep,
                 *, monotonic: Callable = time.monotonic):
        self.transport, self.clock, self.sleep = transport, clock, sleep
        self.monotonic = monotonic
        self.last_request_at: float | None = None

    def fetch(self, url: str, encoding: str = "utf-8") -> BoardPage:
        current = source_url(url, url)
        retries = redirects = 0
        while True:
            if self.last_request_at is not None:
                remaining = MIN_REQUEST_INTERVAL_SECONDS - (self.monotonic() - self.last_request_at)
                if remaining > 0:
                    self.sleep(remaining)
            # This guard is immediately before EVERY board request; no bypass flag.
            # Pacing, retry backoff or a redirect may have crossed the closing time.
            require_scrape_window(self.clock())
            self.last_request_at = self.monotonic()
            try:
                response = self.transport.request("GET", current, headers={
                    "User-Agent": "audit-say-jobs/1.0 (public recruitment listings)",
                    "Accept": "text/html,application/json",
                })
            except NetworkError:
                if retries >= 2:
                    raise
                retries += 1
                self.sleep(2 ** retries)
                continue
            if response.status in {301, 302, 303, 307, 308}:
                redirects += 1
                if redirects > 3 or not response.headers.get("location"):
                    raise WorkerError("board_redirect_rejected")
                current = source_url(response.headers["location"], current)
                continue
            if response.status == 429 or response.status >= 500:
                if retries >= 2:
                    raise WorkerError("board_unavailable")
                retries += 1
                self.sleep(2 ** retries)
                continue
            if response.status != 200:
                raise WorkerError("board_http_rejected")
            try:
                return BoardPage(response.body.decode(encoding), current)
            except (LookupError, UnicodeDecodeError) as error:
                raise WorkerError("board_encoding_invalid") from error


class Store:
    def __init__(self, transport, base_url: str, service_key: str):
        parsed = urlsplit(base_url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise WorkerError("invalid_supabase_url")
        self.transport = transport
        self.base = base_url.rstrip("/") + "/rest/v1/"
        self.headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}",
                        "Content-Type": "application/json", "Prefer": "return=representation"}

    def _request(self, method: str, path: str, payload=None):
        response = self.transport.request(method, self.base + path, headers=self.headers,
                                          data=json.dumps(payload).encode() if payload is not None else None)
        if not 200 <= response.status < 300:
            raise WorkerError("database_request_failed")
        return response.json() if response.body else None

    def rpc(self, name: str, payload: dict):
        return self._request("POST", "rpc/" + name, payload)

    def _select(self, table: str, params: dict):
        result = self._request("GET", table + "?" + urlencode(params))
        if not isinstance(result, list):
            raise WorkerError("invalid_database_response")
        return result

    def firms(self):
        # Explicit pagination avoids Supabase's default row cap changing matches.
        result = []
        offset = 0
        while True:
            page = self._select("cpa_firm_registered", {"select": "firm_id,firm_name,alias", "order": "firm_id",
                                                    "offset": offset, "limit": 500})
            result.extend(page)
            if len(page) < 500:
                return result
            offset += 500

    def ingest(self, board: str, jobs: list[dict]):
        return self.rpc("ingest_cpa_kicpa_jobs", {"p_board": board, "p_jobs": jobs})

    def claim(self):
        rows = self.rpc("claim_cpa_kicpa_job_delivery", {})
        if not isinstance(rows, list) or len(rows) > 1:
            raise WorkerError("invalid_claim_response")
        return rows[0] if rows else None

    def job(self, board: str, identifier: str):
        rows = self._select(JOBS, {"select": "board,id,title,company,posted_at,source_url,firm_id,created_at",
                                   "board": "eq." + board, "id": "eq." + identifier, "limit": 1})
        return rows[0] if rows else None

    def subscriber(self, identifier: str):
        rows = self._select(SUBSCRIBERS, {"select": "*", "id": "eq." + identifier, "limit": 1})
        return rows[0] if rows else None

    def finish(self, delivery: dict, status: str, code: str | None = None,
               provider_message_id: str | None = None):
        delay = min(3600, 300 * 2 ** max(0, int(delivery.get("attempts", 1)) - 1))
        return self.rpc("finish_cpa_kicpa_job_delivery", {
            "p_delivery_id": delivery["id"], "p_status": status,
            "p_error_code": code, "p_retry_seconds": delay,
            "p_provider_message_id": provider_message_id,
        })


class _FullSnapshot:
    """Check unfiltered identities, not just posts matching the CPA title filter."""

    def __init__(self):
        self.signature: tuple | None = None
        self.pages = 0
        self.rows = 0
        self.ids: set[str] = set()

    def add(self, metadata: dict) -> None:
        page, pages, total, count, rows = (metadata[key] for key in
                                         ("page", "total_pages", "total_rows", "list_count", "row_count"))
        if (any(type(value) is not int for value in (page, pages, total, count, rows))
                or page < 1 or pages < 0 or total < 0 or count < 1 or rows < 0):
            raise AdapterError("snapshot_metadata_invalid")
        signature = (pages, total, count)
        if self.signature is not None and self.signature != signature:
            raise AdapterError("snapshot_totals_changed")
        self.signature = signature
        if page != self.pages + 1 or pages != (total + count - 1) // count:
            raise AdapterError("snapshot_page_out_of_order")
        ids = tuple(metadata["regular_ids"])
        ordinals = tuple(metadata["ordinal_numbers"])
        expected_count = min(count, max(0, total - (page - 1) * count))
        if rows != expected_count or len(ids) != rows or len(ordinals) != rows:
            raise AdapterError("snapshot_row_count_mismatch")
        if len(set(ids)) != len(ids) or self.ids.intersection(ids):
            raise AdapterError("snapshot_duplicate_post")
        first_ordinal = total - (page - 1) * count
        if ordinals != tuple(range(first_ordinal, first_ordinal - rows, -1)):
            raise AdapterError("snapshot_ordinal_mismatch")
        self.ids.update(ids)
        self.rows += rows
        self.pages += 1

    def complete(self) -> None:
        if self.signature is None:
            raise AdapterError("snapshot_metadata_missing")
        pages, total, _ = self.signature
        if self.pages != max(1, pages) or self.rows != total or len(self.ids) != total:
            raise AdapterError("snapshot_incomplete")


def collect(config: dict, board_client: BoardClient, store: Store) -> dict:
    index = firm_index(store.firms())
    summaries = {}
    for board in BOARD_URLS:
        item = config["boards"][board]
        combined = {}
        visited = set()
        pages_fetched = 0
        snapshot = _FullSnapshot() if item["format"] == "kicpa_face_v1" else None
        first_page = first_metadata = first_jobs = None
        if snapshot is not None and len(item["urls"]) != 1:
            raise AdapterError("snapshot_single_start_required")
        for start_url in item["urls"]:
            url = start_url
            while url is not None:
                if url in visited:
                    raise AdapterError("pagination_cycle")
                if pages_fetched >= item["pagination"]["max_pages"]:
                    raise AdapterError("snapshot_incomplete_page_limit")
                visited.add(url)
                page = board_client.fetch(url, item.get("encoding", "utf-8"))
                pages_fetched += 1
                if page.final_url != url and page.final_url in visited:
                    raise AdapterError("pagination_cycle")
                # Track request aliases and redirect destinations, but count each
                # fetched page once when applying the configured page limit.
                visited.add(page.final_url)
                jobs = parse_snapshot(page.content, board, config, base_url=page.final_url, firms=index)
                metadata = snapshot_metadata(page.content, item, page.final_url)
                if snapshot is not None:
                    if metadata is None:
                        raise AdapterError("snapshot_metadata_missing")
                    snapshot.add(metadata)
                    if first_page is None:
                        first_page, first_metadata, first_jobs = page, metadata, jobs
                for job in jobs:
                    previous = combined.get(job["id"])
                    if previous and previous != job:
                        raise AdapterError("conflicting_duplicate_post")
                    combined[job["id"]] = job
                if len(combined) > 5000:
                    raise AdapterError("snapshot_too_large")
                url = next_page(page.content, item, page.final_url)
        if snapshot is not None:
            snapshot.complete()
            if snapshot.pages > 1:
                # One bounded extra request detects a shifting head during pagination.
                # It is verification, not another page in the configured page limit.
                head = board_client.fetch(first_page.final_url, item.get("encoding", "utf-8"))
                pages_fetched += 1
                head_metadata = snapshot_metadata(head.content, item, head.final_url)
                head_jobs = parse_snapshot(head.content, board, config, base_url=head.final_url, firms=index)
                if (head.final_url != first_page.final_url or head_metadata != first_metadata
                        or head_jobs != first_jobs):
                    raise AdapterError("snapshot_head_changed")
        # The RPC initializes the baseline and queues only later inserts atomically.
        result = store.ingest(board, list(combined.values()))
        summaries[board] = {**result, "fetched_pages": pages_fetched,
                            "scanned_rows": snapshot.rows if snapshot is not None else len(combined),
                            "matched_jobs": len(combined)}
    return summaries


def env_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise WorkerError("missing_" + name.lower())
    return value
