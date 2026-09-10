"""Vendor-independent delivery contract. No live messaging implementation exists.

Future providers must report accepted (provider queued) separately from sent
(confirmed delivered), map errors to fixed codes, and never retry ambiguous sends.
Selecting/authorizing a vendor and its final-status callback is separate work.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal, Protocol
from urllib.parse import quote, urlsplit

from .adapters import source_url
from .worker import WorkerError, _date


@dataclass(frozen=True)
class Notification:
    idempotency_key: str
    recipient_phone: str = field(repr=False)
    board: str
    requested_boards: tuple[str, ...]
    requested_conditions: str
    title: str
    company: str | None
    posted_at: str | None
    deadline: str | None
    source_url: str
    app_url: str
    settings_url: str


@dataclass(frozen=True)
class DeliveryResult:
    status: Literal["accepted", "sent", "rejected", "uncertain"]
    provider_message_id: str | None = None

    def __post_init__(self):
        if self.status not in {"accepted", "sent", "rejected", "uncertain"}:
            raise ValueError("invalid_provider_result")
        if self.provider_message_id is not None and (
                not isinstance(self.provider_message_id, str) or
                not re.fullmatch(r"[A-Za-z0-9_.:-]{1,200}", self.provider_message_id)):
            raise ValueError("invalid_provider_message_id")
        if self.status == "accepted" and self.provider_message_id is None:
            raise ValueError("accepted_requires_provider_message_id")


class NotificationProvider(Protocol):
    enabled: bool

    def send(self, notification: Notification) -> DeliveryResult:
        """A rejection confirms no send; unknown outcome MUST be uncertain."""
        ...


class DisabledProvider:
    enabled = False

    def send(self, notification: Notification) -> DeliveryResult:
        raise WorkerError("notification_provider_disabled")


class FakeProvider:
    """Offline test double only; it cannot perform HTTP or load credentials."""

    enabled = True

    def __init__(self, results: list[DeliveryResult | Exception]):
        self.results = list(results)
        self.notifications: list[Notification] = []

    def send(self, notification: Notification) -> DeliveryResult:
        self.notifications.append(notification)
        if not self.results:
            raise WorkerError("fake_provider_results_exhausted")
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def configured_provider() -> NotificationProvider:
    # Deliberately no env-based vendor selection. Even ENABLED=true cannot send.
    return DisabledProvider()


def _app_url(job: dict, app_origin: str) -> str:
    parsed = urlsplit(app_origin)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        raise WorkerError("invalid_app_origin")
    path = f"/firms/{quote(str(job['firm_id']), safe='')}?tab=jobs" if job.get("firm_id") else "/jobs"
    return app_origin.rstrip("/") + path


def eligible(subscriber: dict | None, job: dict | None) -> bool:
    """Defense in depth after the DB claim, including paused/reconsented backlog."""
    return bool(subscriber and job and subscriber.get("is_active") and
                subscriber.get("consent_version") == "2026-09-09-v1" and subscriber.get("consented_at") and
                subscriber.get("phone_verified_at") and
                re.fullmatch(r"\+[1-9][0-9]{7,14}", subscriber.get("phone_e164") or "") and
                job["board"] in subscriber.get("boards", []) and
                _date(job.get("created_at")) >= _date(subscriber.get("notifications_since")))


def deliver_one(store, provider: NotificationProvider, delivery: dict, app_origin: str) -> str:
    if not provider.enabled:
        # Also guard direct use. Disabled delivery must not even load a recipient.
        return "disabled"
    job = store.job(delivery["job_board"], delivery["job_id"])
    subscriber = store.subscriber(delivery["subscriber_id"])
    if not eligible(subscriber, job):
        store.finish(delivery, "cancelled", "subscription_ineligible")
        return "cancelled"
    notification = Notification(
        idempotency_key=delivery["id"], recipient_phone=subscriber["phone_e164"],
        board=job["board"], requested_boards=tuple(subscriber["boards"]),
        requested_conditions=" / ".join({
            "trainee_cpa": "수습CPA 게시판의 전체 공고", "cpa": "CPA 게시판의 수습·신입 공고",
        }[board] for board in subscriber["boards"]),
        title=job["title"], company=job.get("company"),
        posted_at=job.get("posted_at"), deadline=job.get("deadline"),
        source_url=source_url(job["source_url"], job["source_url"]), app_url=_app_url(job, app_origin),
        settings_url=app_origin.rstrip("/") + "/settings",
    )
    try:
        result = provider.send(notification)
        if not isinstance(result, DeliveryResult):
            raise WorkerError("invalid_provider_result")
    except Exception:
        # A timeout/crash may follow a successful send. No automatic resend.
        store.finish(delivery, "uncertain", "provider_outcome_uncertain")
        return "uncertain"
    if result.status == "rejected":
        store.finish(delivery, "failed", "provider_rejected")
        return "failed"
    error_code = "provider_outcome_uncertain" if result.status == "uncertain" else None
    store.finish(delivery, result.status, error_code, result.provider_message_id)
    return result.status


def deliver_pending(store, provider: NotificationProvider, app_origin: str,
                    max_deliveries: int = 100) -> dict[str, int]:
    if not provider.enabled:
        # No claim, reads, cancellation, or other queue state changes when disabled.
        return {"disabled": 1}
    _app_url({}, app_origin)
    counts: dict[str, int] = {}
    for _ in range(max_deliveries):
        delivery = store.claim()
        if delivery is None:
            break
        status = deliver_one(store, provider, delivery, app_origin)
        counts[status] = counts.get(status, 0) + 1
    return counts
