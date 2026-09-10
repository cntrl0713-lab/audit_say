"""KICPA public list.face structure verified from saved responses on 2026-09-10.

This module only parses supplied HTML. It never requests detail pages or performs
network I/O. Field positions, ID routing, headers, counters, and pagination are
checked together so a changed layout cannot initialize a partial baseline.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from bs4 import BeautifulSoup

from .adapters import AdapterError, SOURCE_FIELDS, _text, source_url

LAYOUTS = {
    "trainee_cpa": {
        "controller": "jobOffrSrchNewGnrl", "filter": ("ijEmpSep", "all"), "date_column": 6,
        "headers": ("번호", "제목", "회사명", "지역", "구직완료 구분", "고용형태", "등록일자", "조회수"),
    },
    "cpa": {
        "controller": "jobOffrSrchGnrl", "filter": ("ijJobSep", "1"), "date_column": 5,
        "headers": ("번호", "제목", "회사명", "지역", "채용구분", "등록일자", "조회수"),
    },
}
EMPTY_TEXT = "해당하는 글이 존재하지 않습니다."
PAGE_SIZE = 100
# The real listCnt=100 responses retain this static form default, including page 2.
OBSERVED_FORM_LIST_COUNT = "20"


@dataclass(frozen=True)
class LivePage:
    rows: list[dict]
    metadata: dict
    next_url: str | None


def expected_fields(board: str) -> dict:
    return {
        "id": "fn_detail.ijIdNum", "title": "a.subject_title", "company": "td[2]",
        "posted_at": f"td[{LAYOUTS[board]['date_column']}]", "source_url": "detailForm.action?ijIdNum",
    }


def _path_matches(path: str, expected: str) -> bool:
    # Session IDs in the two observed form actions must not leak into source links.
    return re.fullmatch(re.escape(expected) + r"(?:;jsessionid=[A-Za-z0-9._-]+)?", path) is not None


def _request_info(url: str, board: str, *, first_page: bool = False) -> tuple[int, dict[str, str]]:
    parsed = urlsplit(source_url(url, url))
    layout = LAYOUTS[board]
    if not _path_matches(parsed.path, f"/home/{layout['controller']}/list.face") or parsed.fragment:
        raise AdapterError("live_list_url_changed")
    query = parse_qs(parsed.query, keep_blank_values=True)
    filter_name, filter_value = layout["filter"]
    expected = {"listCnt", "page", filter_name}
    if set(query) != expected or any(len(values) != 1 for values in query.values()):
        raise AdapterError("live_list_query_changed")
    flat = {key: values[0] for key, values in query.items()}
    if (flat["listCnt"] != str(PAGE_SIZE) or flat[filter_name] != filter_value
            or not re.fullmatch(r"[1-9][0-9]*", flat["page"])):
        raise AdapterError("live_list_query_changed")
    page = int(flat["page"])
    if first_page and page != 1:
        raise AdapterError("live_snapshot_must_start_at_first_page")
    return page, flat


def validate_live_config(item: dict, board: str) -> None:
    if board not in LAYOUTS or item.get("board") != board or item.get("format") != "kicpa_face_v1":
        raise AdapterError("invalid_live_board_config")
    if item.get("fields") != expected_fields(board):
        raise AdapterError("live_field_mappings_changed")
    if not isinstance(item.get("urls"), list) or len(item["urls"]) != 1:
        raise AdapterError("live_single_start_url_required")
    _request_info(item["urls"][0], board, first_page=True)
    if item.get("encoding", "utf-8") != "utf-8":
        raise AdapterError("live_encoding_changed")
    limit = item.get("pagination", {}).get("max_pages")
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 100:
        raise AdapterError("pagination_limit_required")


def _one(node, selector: str, code: str):
    found = node.select(selector)
    if len(found) != 1:
        raise AdapterError(code)
    return found[0]


def _form_action(form, expected_path: str, base: str) -> str:
    value = form.get("action", "")
    parsed = urlsplit(source_url(value, base))
    if (not _path_matches(parsed.path, expected_path) or parsed.query or parsed.fragment
            or str(form.get("method", "")).lower() != "post"):
        raise AdapterError("live_form_action_changed")
    return urlunsplit((parsed.scheme, parsed.netloc, expected_path, "", ""))


def _verify_detail_script(scripts: str) -> None:
    declarations = list(re.finditer(r"function\s+fn_detail\s*\(\s*bltnNo\s*\)\s*\{", scripts))
    if len(declarations) != 1:
        raise AdapterError("live_detail_script_changed")
    body = re.split(r"\bfunction\s+", scripts[declarations[0].end():], maxsplit=1)[0]
    assign = re.search(r"\$\(\s*['\"]#detailForm\s*>\s*#ijIdNum['\"]\s*\)\.val\(\s*bltnNo\s*\)\s*;", body)
    submit = re.search(r"\$\(\s*['\"]#detailForm['\"]\s*\)\.submit\(\s*\)\s*;", body)
    if assign is None or submit is None or assign.start() >= submit.start():
        raise AdapterError("live_detail_script_changed")


def parse_live_page(content: str, item: dict, base: str) -> LivePage:
    board = item.get("board")
    if board not in LAYOUTS or set(item.get("fields", {})) != SOURCE_FIELDS:
        raise AdapterError("invalid_live_board_config")
    validate_live_config(item, board)
    requested_page, query = _request_info(base, board)
    layout = LAYOUTS[board]
    soup = BeautifulSoup(content, "html.parser")
    table = _one(soup, "table.table_st02", "live_table_structure_changed")
    headers = tuple(_text(node.get_text(" ", strip=True)) for node in table.select("thead th"))
    if headers != layout["headers"]:
        raise AdapterError("live_table_headers_changed")
    tbody = _one(table, "tbody", "live_table_structure_changed")
    search_form = _one(soup, "form#searchForm", "live_search_form_changed")
    detail_form = _one(soup, "form#detailForm", "live_detail_form_changed")
    controller = layout["controller"]
    list_action = _form_action(search_form, f"/home/{controller}/list.face", base)
    detail_action = _form_action(detail_form, f"/home/{controller}/detail.face", base)
    page_input = _one(search_form, "input[name=page][type=hidden]", "live_search_form_changed")
    list_input = _one(search_form, "input[name=listCnt][type=hidden]", "live_search_form_changed")
    if page_input.get("value") != str(requested_page) or list_input.get("value") != OBSERVED_FORM_LIST_COUNT:
        raise AdapterError("live_hidden_pagination_changed")

    scripts = "\n".join(node.get_text() for node in soup.select("script"))
    _verify_detail_script(scripts)
    _one(soup, "#pagingArea", "live_pagination_changed")
    paging = re.findall(
        r"document\.getElementById\(\s*['\"]pagingArea['\"]\s*\)\.innerHTML\s*=\s*"
        r"fn_setPage\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)\s*;", scripts)
    if len(paging) != 1:
        raise AdapterError("live_pagination_changed")
    current, total_pages, page_group = map(int, paging[0])
    total_node = _one(soup, "p.total", "live_total_count_changed")
    total_match = re.fullmatch(r"\(총\s+([0-9]+|[1-9][0-9]{0,2}(?:,[0-9]{3})+)\s+건\)",
                              _text(total_node.get_text(" ", strip=True)))
    if total_match is None:
        raise AdapterError("live_total_count_changed")
    total_rows = int(total_match[1].replace(",", ""))
    if (current != requested_page or page_group != 10 or total_pages != math.ceil(total_rows / PAGE_SIZE)
            or not 1 <= current <= max(1, total_pages)):
        raise AdapterError("live_pagination_count_mismatch")
    if total_pages > item["pagination"]["max_pages"] or total_rows > 5000:
        raise AdapterError("snapshot_incomplete_page_limit")

    html_rows = tbody.find_all("tr", recursive=False)
    rows: list[dict] = []
    ids: list[str] = []
    ordinals: list[int] = []
    columns = len(layout["headers"])
    if total_rows == 0:
        empty_cells = html_rows[0].find_all("td", recursive=False) if len(html_rows) == 1 else []
        if (current != 1 or total_pages != 0 or len(empty_cells) != 1
                or empty_cells[0].get("colspan") != str(columns)
                or _text(empty_cells[0].get_text(" ", strip=True)) != EMPTY_TEXT):
            raise AdapterError("live_empty_state_changed")
    else:
        expected_rows = min(PAGE_SIZE, total_rows - (current - 1) * PAGE_SIZE)
        if len(html_rows) != expected_rows:
            raise AdapterError("live_row_count_mismatch")
        for index, row in enumerate(html_rows):
            cells = row.find_all("td", recursive=False)
            if len(cells) != columns:
                raise AdapterError("live_row_columns_changed")
            ordinal = _text(cells[0].get_text(" ", strip=True))
            if not re.fullmatch(r"[1-9][0-9]*", ordinal):
                # No notice/pinned layout has been observed. Never guess its meaning.
                raise AdapterError("live_non_regular_row")
            number = int(ordinal)
            if number != total_rows - (current - 1) * PAGE_SIZE - index:
                raise AdapterError("live_row_order_changed")
            anchor = _one(cells[1], "a.subject_title", "live_title_link_changed")
            onclick = re.fullmatch(r"\s*javascript:\s*fn_detail\(\s*(['\"])([0-9]{13})\1\s*\)\s*;?\s*",
                                   anchor.get("onclick", ""))
            if onclick is None or anchor.get("href") != "#":
                raise AdapterError("live_post_identity_changed")
            identifier = onclick[2]
            if identifier in ids:
                raise AdapterError("live_duplicate_post_identity")
            title = _text(anchor.get_text(" ", strip=True))
            company = _text(cells[2].get_text(" ", strip=True))
            posted = _text(cells[layout["date_column"]].get_text(" ", strip=True))
            if not title or len(title) > 1000:
                raise AdapterError("live_title_changed")
            if not company or len(company) > 500 or not any(letter.isalpha() for letter in company):
                raise AdapterError("live_company_changed")
            if not re.fullmatch(r"[0-9]{4}\.[0-9]{2}\.[0-9]{2}", posted):
                raise AdapterError("live_posted_date_changed")
            try:
                posted = date.fromisoformat(posted.replace(".", "-")).isoformat()
            except ValueError as error:
                raise AdapterError("live_posted_date_changed") from error
            rows.append({"id": identifier, "title": title, "company": company, "posted_at": posted,
                         "source_url": detail_action + "?" + urlencode({"ijIdNum": identifier})})
            ids.append(identifier)
            ordinals.append(number)

    next_url = None
    if current < total_pages:
        query["page"] = str(current + 1)
        next_url = list_action + "?" + urlencode(query)
    return LivePage(rows, {"page": current, "total_pages": total_pages, "total_rows": total_rows,
                           "list_count": PAGE_SIZE, "row_count": len(rows), "regular_ids": tuple(ids),
                           "ordinal_numbers": tuple(ordinals)}, next_url)
