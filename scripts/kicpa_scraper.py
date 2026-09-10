#!/usr/bin/env python3
"""KICPA worker. --fixture and --dry-run never make any external request."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from kicpa_jobs.adapters import AdapterError, next_page, parse_snapshot, validate_config
from kicpa_jobs.providers import configured_provider, deliver_pending
from kicpa_jobs.worker import (BoardClient, OutsideWindow, Store, Transport,
                               WorkerError, collect, env_required, require_scrape_window, utcnow)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=os.environ.get("KICPA_BOARD_CONFIG"))
    parser.add_argument("--fixture", type=Path, help="Read a local saved response; no HTTP, DB, or messaging calls")
    parser.add_argument("--board", choices=("trainee_cpa", "cpa"))
    parser.add_argument("--dry-run", action="store_true", help="Offline config/fixture validation only")
    parser.add_argument("--max-deliveries", type=int, default=100)
    args = parser.parse_args(argv)
    if not 0 <= args.max_deliveries <= 1000:
        parser.error("--max-deliveries must be between 0 and 1000")
    offline = args.dry_run or args.fixture is not None
    try:
        if not offline:
            # Off-hours exits before any board, DB, or messaging request.
            require_scrape_window(utcnow())
            if os.environ.get("KICPA_BOARD_LAYOUT_VERIFIED") != "true":
                raise WorkerError("board_layout_unverified")
        if args.config is None:
            raise WorkerError("board_config_required")
        config = json.loads(args.config.read_text(encoding="utf-8-sig"))
        validate_config(config, live=not offline)
        if offline:
            result = {"mode": "offline", "config_valid": True, "external_requests": 0}
            if args.fixture is not None:
                if args.board is None:
                    raise WorkerError("fixture_board_required")
                content = args.fixture.read_text(encoding=config["boards"][args.board].get("encoding", "utf-8"))
                jobs = parse_snapshot(content, args.board, config)
                more = next_page(content, config["boards"][args.board], config["boards"][args.board]["urls"][0])
                result.update(jobs=jobs, has_next_page=more is not None)
            print(json.dumps(result, ensure_ascii=False))
            return 0

        transport = Transport()
        store = Store(transport, env_required("SUPABASE_URL"), env_required("SUPABASE_SERVICE_ROLE_KEY"))
        summaries = collect(config, BoardClient(transport), store)
        print(json.dumps({"event": "collected", "boards": {
            name: {key: values.get(key) for key in ("inserted", "queued", "baseline")}
            for name, values in summaries.items()
        }}))
        provider = configured_provider()
        if not provider.enabled or os.environ.get("KICPA_NOTIFICATIONS_ENABLED") != "true":
            print(json.dumps({"event": "delivery_disabled"}))
            return 0
        counts = deliver_pending(store, provider, env_required("KICPA_APP_ORIGIN"), args.max_deliveries)
        print(json.dumps({"event": "deliveries", "counts": counts}))
        return 0
    except OutsideWindow:
        print(json.dumps({"event": "skipped", "code": "outside_kst_scrape_window"}))
        return 0
    except (AdapterError, WorkerError) as error:
        print(json.dumps({"event": "failed", "code": str(error)}))
        return 1
    except Exception:
        # Do not emit exception strings/tracebacks that can contain credentials.
        print(json.dumps({"event": "failed", "code": "unexpected_worker_error"}))
        return 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
