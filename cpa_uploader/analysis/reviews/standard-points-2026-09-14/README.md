# 기준서형 배점 전수 재검토

2026-09-14의 기준서형 354물음에 관한 배점·부분정답·분리·통합·삭제 **검토와 수정안**이다. 모든 물음의 발문·모범답안·criterion·critical_facts·요구 인용을 담당 agent가 대조했다. 검토만 요청한 범위이며 정본·공개본·운영 DB에 문항 변경을 적용하지 않는다.

[결과 보고서](../../../../docs/reports/standard-points-2026-09-14.md) · [통합 장부](review-ledger.json) · [검사 결과](completion-checks.json)

## 파일의 역할

| 파일 | 역할 |
|---|---|
| `bank.snapshot.json`, `classifications.snapshot.json` | 작업 시작 시점 원문·학습 분류의 바이트 사본. 동결 후 덮어쓰지 않음 |
| `inventory.json`, `input-*.json` | 동결 자료에서 뽑은 대상 ID·독립 발문·답안·기준·출처. 자동 추출은 의미검토 판정이 아님 |
| `manual-01-05.py`, `build-review-11-14.py`, `write-review-*.mjs` 등 | 읽은 내용에 대한 수동 판단을 직렬화하는 입력. 자동 점수판정 프로그램이 아님 |
| `review-01-05.json`, `review-06-10.json`, `review-10.json`, `review-11-14.json`, `review-15-19.json` | 담당별 물음·criterion 전수 판단. 06–10 파일은 인계 후 06–09만, 10은 별도 파일 |
| `source-and-scope-checks.json`, `source-check*.json` | 실제 파일·인용 결속 및 초안 탐색 검사. 내용·최신판본 승인과 구별 |
| `review-ledger.json`, `details/topic-*.md` | 수동 장부를 통합한 기계 판독 결과와 주제별 상세표 |
| `completion-checks.json` | 물음·criterion 누락/중복, ID·배점, 종료시 현재 대상 내용 일치 검사 |
| `compile-report.mjs` | 통합 장부·주제별 표·보고서 생성기 |

`decision`은 주된 변경 방향이다. `split` 또는 `merge`에도 배점 조정이 함께 있을 수 있다. `proposed_points`는 원 물음에서 남길 고유 요구의 기여점수이며, 통합을 받는 물음에는 들어오는 점수를 중복 합산하지 않는다. 실제 분리·통합 후 배점은 `proposal`에 적는다. 새 문제은행 총점·물음 수를 확정하는 자료는 아니다.

## 확인 방법

```powershell
node cpa_uploader/analysis/reviews/standard-points-2026-09-14/compile-report.mjs
```

현재 기준서형 물음의 발문·답안·배점·출처·독립 발문·주제가 동결 자료와 달라지면 검사에 실패한다. 후속 판본 검토는 별도 폴더에서 시작한다. `prepare.mjs`는 기존 동결 사본이 있으면 덮어쓰지 않는다.

통합 생성 후 보고서·주제별 장부 링크, 물음별 분리 배점·통합 대상의 정합성을 확인한다. 정책·코드·wiki 생성입력을 바꾸는 작업이 아니므로 전체 앱 테스트·wiki 재생성은 수행하지 않는다.

## 증거의 한계

- 이번 검토는 등록된 로컬 출처의 해당 인용과 문항 요구를 대조한 배점구조 검토다. 최신 공식판본·시행공고·시험 적용판본을 전수 재확인한 것이 아니다.
- 특정 문항의 근거 범위·발문에 주어진 정답 등 추가 문제는 장부 `issues`와 판정에 기록한다. 원자료 내용 오류에 허용률을 적용하지 않는다.
- 유료 API 의미검수·Luna 실제 채점·사람 확인·정본수록·게시를 수행한 것으로 표시하지 않는다. ±1점·95%의 실제 채점 목표 달성 여부는 미측정이다.
- 후속 수정에서는 과거 ID·반례·실측·봉인 판본을 보존하고 새 발문·답안·채점기준을 함께 검증한다.
