# 문항 수정 패치(correction)

게시된 세트를 고칠 때 편집 정본 전체나 전체 은행 사본을 다시 쓰지 않는다. 바꿀 필드와 수정 전 값만 적은 파일 하나를 이곳에 두고, 도구가 정본을 메모리에서 고쳐 검증한 뒤 대상 세트의 바이트만 바꾼다. 운영 정책과 배경은 [문항 수정 패치 운영](../../docs/문항-수정-패치-운영.md)에 있다.

| 경로 | 내용 | 수정 |
| --- | --- | --- |
| `<correction_id>.json` | 세트 하나의 수정 명세 | 작성 후 검토. 게시하면 바꾸지 않는다 |
| `<correction_id>.json` (`artifact_type: question_set_replacement`) | 세트 하나의 통째 교체 명세(물음 구성 변경). 아래 [통째 교체 명세](#통째-교체-명세물음-구성-변경) | 작성 후 검토. 게시하면 바꾸지 않는다 |
| `applied/<correction_id>.json` | 정본 설치 기록(명세 해시, 내용 해시 전후, 승급 장부 위치, 정본 파일 해시) | `publish`만 쓴다 |

`tests/questionCorrectionArtifacts.test.ts`가 파일 이름·형식·크기와 게시 후 명세 불변을 검사한다.

## 명세

```json
{
  "version": 1,
  "artifact_type": "question_set_correction",
  "correction_id": "20260919-pilot-99-001--claim-subject",
  "set_id": "pilot-99-001",
  "summary": "criterion 명제의 주체를 분명히 한다",
  "base_content_hash": "<작성 당시 세트의 reviewedContentHash>",
  "patches": [
    {
      "target": { "subquestion": "sub1", "criterion": "crit2", "field": "claim" },
      "reason": "누가 수행하는지 명제에 없어 조건 누락 답안이 충족으로 읽힌다.",
      "expected_before": "경영진에게 서면진술을 요청한다고 설명함",
      "set": "감사인이 경영진에게 서면진술을 요청한다고 설명함"
    }
  ]
}
```

위 세트 ID와 값은 형식 예시다.

- `correction_id`: `YYYYMMDD-<set_id>--<slug>`. 파일 이름은 `<correction_id>.json`이다. 한 파일은 세트 하나만 고친다.
- `base_content_hash`: 비계가 채운다. 세트의 다른 필드가 그사이 바뀌었으면 적용을 거절한다(다른 작업을 덮어쓰지 않는다).
- `expected_before`: 필드별 수정 전 값. 현재 정본과 다르면 거절한다. 선택 필드가 없던 상태는 `{"$absent": true}`로 쓴다(`decision: null`과 구분).
- `reason`: 패치마다 수정 이유. `TODO`로 시작하면 거절한다.
- `classification_entries`(선택): 학습 유형·주제를 바꾸거나, 따로 다듬은 기준서형 독립 발문의 원 발문을 바꾸거나, 연결한 사실 ID를 지울 때 새 분류와 근거를 적는다. 기계적으로 따라오는 변경(독립 발문이 원 발문 그대로였던 경우)은 도구가 반영한다.

수정할 수 있는 대상(`target`):

| 범위 | 표기(CLI) | 필드 |
| --- | --- | --- |
| 세트 | `title` 등 | `title`, `classification.tags`, `classification.standards`, `verification.notes`, `verification.source_fidelity`, `learning_order`, `source_refs`, `shared_context.facts` |
| 물음 | `sub=<물음>:<필드>` | `prompt`, `type`, `model_answer`, `answer_slots`, `decision`, `question_style`, `topic_ids`, `requirements`, `criteria` |
| criterion | `crit=<물음>/<criterion>:<필드>` | `claim`, `requirement_id`, `critical_facts`, `max_points`, `scores`, `source_ref_ids` |
| requirement | `req=<물음>/<requirement>:<필드>` | `source_ref_id`, `source_quote`, `source_span` |
| 출처 | `src=<출처>:<필드>` | `file`, `title`, `page`, `source_quote`, `role`, `content_hash`, `source_span` |
| 사실 | `fact=<사실>:<필드>` | `text` |

배열 전체 교체(`criteria`, `requirements`, `source_refs`, `shared_context.facts`)로 병합·분할을 표현한다. 배열 전체와 그 안의 원소를 한 명세에서 함께 바꾸지 않는다. ID·수명주기 라벨(`status`, `review_status`)·주제 구조(`topic_id`, `part`, `chapter`, `domain`)·물음 구성·답안 정책(`constraints`, `selection`)은 patch로 바꾸지 않는다. **물음 구성·답안 정책이 바뀌는 판본은 같은 ID의 [통째 교체 명세](#통째-교체-명세물음-구성-변경)로 낸다.** ID·수명주기 라벨·주제 구조는 교체로도 바꾸지 못하며, 그런 변경(병합·분리처럼 ID가 바뀌는 경우)과 초안(`needs_review`) 수정은 제작 경로를 따른다.

## 순서

```sh
# 1. 비계(읽기 전용): 현재 값이 expected_before와 set에 들어간다
npm run questions:v3:correct -- scaffold --set <set_id> --slug <slug> --summary "<요약>" --target "crit=sub1/crit2:claim"
# 2. set과 reason을 채운 뒤 검사(쓰기 없음): 세트·은행 전체 검증, 바뀌는 값, 배점·공개본·분류 영향
npm run questions:v3:correct -- check cpa_uploader/corrections/<id>.json
# 3. 검수용 부분 은행(수정 세트만)·분류 카탈로그·검사 기록
npm run questions:v3:correct -- evidence cpa_uploader/corrections/<id>.json --out-dir cpa_uploader/analysis/reviews/<배치>
# 4. 비용 통제 검수(에이전트 대조 + Luna 대표 채점)를 위 부분 은행으로 수행하고 batch.json을 만든다
# 5. 정본 설치: tmp/ 스테이지에서 재검수·재게시·컴파일·분류 카탈로그·전체 검증 후 원자적으로 교체
npm run questions:v3:correct -- publish cpa_uploader/corrections/<id>.json --efficient-review <batch.json> --evidence "<근거>"
# 6. 생성물: npm run analysis:build → analysis:check → wiki:build → wiki:check
# 7. 운영 반영(사용자가 실행): npm run questions:v3:release -- inspect|prepare|probe|apply|verify …
```

- 여러 세트를 한 번에 게시하려면 correction 파일을 여러 개 넘긴다. 세트마다 correction은 하나다.
- 3단계 검수 manifest의 `bank`·`classifications`는 부분 은행과 그 카탈로그를 쓴다. 대표 채점 receipt 검증기는 manifest 은행이 덮는 세트만 요구한다. 전체 은행 후보 사본을 만들지 않는다. 의미검수 경로(`--review`)의 비교 은행은 `tmp/`에 두고 receipt에는 해시만 남는다.
- `publish --stage-only`는 설치하지 않고 스테이지 검증만 한다. 스테이지와 로그는 `tmp/question-corrections/<run>/`에 남고 커밋하지 않는다.
- 설치 결과: 정본은 대상 세트 줄만, 공개본은 대상 세트의 공개 필드만, 승급 장부는 세트당 두 항목(재검수·재게시)만 바뀐다. 암호화본은 전체가 새로 암호화된다. 분류 카탈로그는 현재 분류 입력(`cpa_uploader/data/learning-question-classification-review.json`)을 이어받아 수정 세트 항목만 바꾼다.
- 같은 correction은 한 번만 설치된다(`applied/` 기록). 게시 후 다시 고치려면 새 correction을 만든다.

## 통째 교체 명세(물음 구성 변경)

물음을 더하거나 빼거나 다시 쓰는 판본은 patch로 표현할 수 없다. 같은 세트 ID로 세트 객체 전체를 담은 교체 명세를 같은 폴더에 두고 같은 절차(check → evidence → publish → 운영 반영)로 설치한다. 퇴역·새 ID·wiki 퇴역·가드 승인 목록 갱신이 필요 없고, 운영 반영은 `questions:v3:release`의 교체(같은 위치의 세트 내용 변경)로 간다. 과거 판본은 DB의 봉인 버전으로 남는다. 2026-09-21까지의 단독 갱신 회차(D등급 r33~r40)가 퇴역 + 새 ID로 갔던 것은 이 경로가 없었기 때문이다.

```sh
npm run questions:v3:correct -- scaffold --replace --set <set_id> --slug <slug> --summary "<요약>"
```

비계는 현재 세트를 `replacement`에 그대로 두고 대응·이유·분류 근거를 `TODO`로 채운다. 채우기 전에는 파서가 거절한다.

| 키 | 내용 |
| --- | --- |
| `replacement` | 새 판본 전체. `id`·`schema_version`·`type`·`classification`의 주제 구조·`verification.calculation_required`·수명주기 라벨(`status`, `review_status`)은 현재 값 그대로 둔다. 주제가 다르면 새 세트다 |
| `lineage.reason` | 물음 구성을 바꾸는 이유 |
| `lineage.subquestions`, `lineage.criteria` | 물음과 `<물음>/<criterion>`의 전후 대응. 현재 세트의 모든 ID가 `before`에, 새 판본의 모든 ID가 `after`에 정확히 한 번씩 나와야 한다. `disposition`은 `kept`·`rewritten`·`split`·`merged`·`added`·`removed`이고 `note`에 대응 설명을 적는다 |
| `lineage.dropped_requirements` | 선택. 버린 요구와 이유, 은행의 대체 문항(`covered_elsewhere`) 또는 `false` |
| `classification_entries` | 새 판본의 **모든 물음**의 학습 유형·주제·독립 발문·사실 연결과 근거. 이전 분류를 이어받지 않는다 |
| `coverage_retargets` | 관계 장부(`cpa_uploader/analysis/coverage/links.json`)의 은행 관계가 가리키던 물음·criterion이 사라지면 새 대상(또는 `null`)과 이유. `review_status`를 적지 않으면 `needs_review`이며, 대상이 있으면 물음 지문 해시를 새로 적는다 |

- `check`는 이 세트를 가리키는 은행 관계를 모두 대조해, 사라진 대상을 다시 연결하지 않았으면 거절한다. `publish`는 정본·장부·공개본·카탈로그와 함께 관계 장부를 한 번의 원자적 쓰기로 바꾸고, 적용 기록(`applied/`, `artifact_type: question_set_replacement_application`)에 대응과 재연결 전후를 남긴다. 설치 뒤 `npm run analysis:build`로 registry를 다시 만든다.
- 검수·대표 채점은 correction과 같이 `evidence`가 만든 부분 은행으로 한다. 물음 구성이 바뀌었으므로 새 판본의 모든 물음이 검수 대상이다.
- 여러 세트를 합치거나 나누어 ID가 바뀌는 병합·분리는 여전히 제작 경로(퇴역 + 새 세트)다.
