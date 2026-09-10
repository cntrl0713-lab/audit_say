"""Configurable adapters, deliberately without guessed live KICPA selectors."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

BOARD_URLS = {
    "trainee_cpa": "https://www.kicpa.or.kr/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu07.page",
    "cpa": "https://www.kicpa.or.kr/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu01.page",
}
SOURCE_FIELDS = frozenset({"id", "title", "company", "posted_at", "source_url"})


class AdapterError(ValueError):
    """A fixed, non-sensitive error code; never include response bodies."""


def source_url(value: str, base: str) -> str:
    url = urljoin(base, value)
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or parsed.hostname not in {"www.kicpa.or.kr", "kicpa.or.kr"}
            or parsed.username or parsed.password or parsed.port not in {None, 443}
            or not value or len(url) > 2000 or any(ord(c) < 32 for c in url)):
        raise AdapterError("invalid_source_url")
    return url


def normalized_company(value: str) -> str:
    # Exact whole-name matching only. Do not remove '회계법인' or guess from titles.
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value)).casefold()


def firm_index(firms: list[dict]) -> dict[str, int | None]:
    candidates: dict[str, set[int]] = {}
    for firm in firms:
        for name in [firm["firm_name"], *(firm.get("alias") or [])]:
            key = normalized_company(name)
            if key:
                candidates.setdefault(key, set()).add(int(firm["firm_id"]))
    return {key: next(iter(ids)) if len(ids) == 1 else None for key, ids in candidates.items()}


def _path(value, path: str):
    if path == "$":
        return value
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            raise AdapterError("missing_json_field")
        value = value[part]
    return value


def _text(value) -> str:
    if value is None:
        return ""
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        raise AdapterError("invalid_field_type")
    return re.sub(r"\s+", " ", str(value)).strip()


def _html_field(row, field: dict) -> str:
    node = row if field.get("selector") == "$" else row.select_one(field["selector"])
    if node is None:
        if field.get("optional"):
            return ""
        raise AdapterError("missing_html_field")
    return _text(node.get(field["attribute"], "") if "attribute" in field else node.get_text(" ", strip=True))


def _field_mappings(item: dict) -> dict:
    fields = item.get("fields")
    if not isinstance(fields, dict) or set(fields) != SOURCE_FIELDS:
        raise AdapterError("field_mappings_must_match_minimal_scope")
    return fields


def validate_config(config: dict, *, live: bool = False) -> None:
    if not isinstance(config, dict) or set(config.get("boards", {})) != set(BOARD_URLS):
        raise AdapterError("both_board_configs_required")
    if live and config.get("synthetic", False):
        raise AdapterError("synthetic_config_not_for_live")
    for board, item in config["boards"].items():
        if item.get("format") not in {"html", "json"}:
            raise AdapterError("unsupported_board_format")
        urls = item.get("urls")
        if not isinstance(urls, list) or not 1 <= len(urls) <= 20:
            raise AdapterError("explicit_snapshot_urls_required")
        for url in urls:
            source_url(url, BOARD_URLS[board])
        _field_mappings(item)
        if item["format"] == "html":
            if not all(item.get(key) for key in ("rows_selector", "empty_selector", "pinned_selector")):
                raise AdapterError("html_structure_markers_required")
        elif not item.get("rows_path") or not item.get("pinned_path") or "pinned_values" not in item:
            raise AdapterError("json_structure_markers_required")
        pagination = item.get("pagination", {})
        if not isinstance(pagination.get("max_pages"), int) or not 1 <= pagination["max_pages"] <= 100:
            raise AdapterError("pagination_limit_required")
        if item["format"] == "html" and not all(pagination.get(key) for key in ("next_selector", "end_selector")):
            raise AdapterError("pagination_markers_required")
        if item["format"] == "json" and not pagination.get("next_path"):
            raise AdapterError("pagination_markers_required")


def next_page(content: str, item: dict, base: str) -> str | None:
    """Missing pagination is an error, not an assumption of a complete snapshot."""
    pagination = item["pagination"]
    if item["format"] == "html":
        soup = BeautifulSoup(content, "html.parser")
        next_node = soup.select_one(pagination["next_selector"])
        end = soup.select_one(pagination["end_selector"])
        if next_node is not None and end is not None:
            raise AdapterError("ambiguous_pagination")
        if next_node is not None:
            return source_url(next_node.get("href", ""), base)
        if end is None:
            raise AdapterError("pagination_structure_changed")
        return None
    try:
        value = _path(json.loads(content), pagination["next_path"])
    except (ValueError, TypeError) as error:
        raise AdapterError("pagination_structure_changed") from error
    if value is None:
        return None
    if not isinstance(value, str) or not value:
        raise AdapterError("invalid_next_page")
    return source_url(value, base)


def parse_snapshot(content: str, board: str, config: dict, *, base_url: str | None = None,
                   firms: dict[str, int | None] | None = None) -> list[dict]:
    if board not in BOARD_URLS:
        raise AdapterError("invalid_board")
    item = config["boards"][board]
    base = base_url or item["urls"][0]
    # Enforce the allowlist before parsing, including direct/offline adapter use.
    fields = _field_mappings(item)
    parsed_rows: list[dict] = []
    if item["format"] == "html":
        soup = BeautifulSoup(content, "html.parser")
        rows = soup.select(item["rows_selector"])
        if not rows and not soup.select_one(item["empty_selector"]):
            raise AdapterError("board_structure_changed")
        for row in rows:
            if row.select_one(item["pinned_selector"]) or row.css.match(item["pinned_selector"]):
                continue
            parsed_rows.append({name: _html_field(row, spec) for name, spec in fields.items()})
    else:
        try:
            rows = _path(json.loads(content), item["rows_path"])
        except (ValueError, TypeError) as error:
            raise AdapterError("invalid_board_json") from error
        if not isinstance(rows, list):
            raise AdapterError("json_rows_not_list")
        for row in rows:
            if _path(row, item["pinned_path"]) in item["pinned_values"]:
                continue
            record = {}
            for name, spec in fields.items():
                if isinstance(spec, str):
                    spec = {"path": spec}
                try:
                    record[name] = _text(_path(row, spec["path"]))
                except AdapterError:
                    if not spec.get("optional"):
                        raise
                    record[name] = ""
            parsed_rows.append(record)

    result: dict[str, dict] = {}
    for row in parsed_rows:
        identifier = row["id"]
        title = row["title"]
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", identifier) or not title or len(title) > 1000:
            raise AdapterError("invalid_post_identity")
        if board == "cpa" and not re.search("수습|신입", title):
            continue
        posted_at = row.get("posted_at", "")
        if posted_at:
            try:
                # Only an explicit complete date is accepted, never infer its year.
                posted_at = date.fromisoformat(re.sub(r"[./]", "-", posted_at).rstrip("-")).isoformat()
            except ValueError as error:
                raise AdapterError("invalid_posted_at") from error
        else:
            raise AdapterError("missing_posted_at")
        company = row.get("company", "") or None
        if company and len(company) > 500:
            raise AdapterError("invalid_company")
        job = {
            "id": identifier, "board": board, "title": title, "company": company,
            "posted_at": posted_at,
            "source_url": source_url(row["source_url"], base),
            "firm_id": (firms or {}).get(normalized_company(company)) if company else None,
        }
        if identifier in result and result[identifier] != job:
            raise AdapterError("conflicting_duplicate_post")
        result[identifier] = job
    return list(result.values())
