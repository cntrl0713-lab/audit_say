# 효율 검증 60초 경계 — 읽기 전용 측정

importer의60초 한도는 실제 위험이다. scripts/import-question-bank-v3.ts:127의 spawnSync(timeout:60_000)는 구조·출처·승급 장부·공개본을 검사하는 validate_cpa_v3.ts 전체에 적용된다. root의 prepare-final003.log 생성04:24:22 UTC→완료04:25:36 UTC 약74초도 확인했다. 이는 준비파일 시간 구간이며 최종 importer 자식의 직접 측정은 아니다. 실제 스테이징 전체 시간을 최종 판단 기준으로 삼는다.

## 반복 경로

validatePromotionLedger는 context를 공유하고 validateBatch가 같은 batch를 memo하므로120세트마다 전체735관측을 재검증하지 않는다. 그러나 각 validateReusableEfficientObservation은 약3.7MB 은행과338KB 분류를 반복 read/hash/parse한다. 기존 context.files는 해시 장부일 뿐 읽기/parse 캐시가 아니다. validateBatch는 reuse 검증에서 원응답을 재생한 뒤 전체 entry 순회에서 한 번 더 재생한다. Ajv는 매 replay마다 새 compile을 하지만20건에서 약0.089초여서 이번 주병목은 아니다.

## 측정

원run-v1 1개와run-v2 19개를 같은 public validator, 공유context로 검사했다. 모두 통과했다. 같은20개를 격리된 제안 스냅샷에서도 다시 로컬 재생했다. 이는 API40회가 아니라 실제 과거20관측의 로컬 검사다. 프로파일 wrapper는 fs.readFileSync/Ajv.compile 인자·반환값을 그대로 전달하며 종료 후 복원했다.

| 항목 | 현재코드 측정 | 제안 스냅샷 측정 |
| --- | ---: | ---: |
| 20관측 | 5.288초 | 4.673초 |
| 원origin 최초준비2개 | 4.294초 | 4.332초 |
| warm18개 평균 | 55.04ms | 18.90ms |
| 읽기 바이트 | 약220MB | 약143MB |
| 읽기 호출 | 3252 | 3213 |
| Ajv compile | 20회 | 20회 |
| 마지막 실바이트 guard | 1.549초 | 1.325초 |
| 735건 한 차례 재생 단순환산 | 44.6초 | 18.2초 |

마지막 행은 전체 validator 시간이 아니다. 두 번째 replay,5097inputs, 구조·출처·장부·공개본·최종guard가 추가된다. OS cache를 비우지 않았고 병행 부하도 통제하지 않아 시간차 전부를 순수 캐시 효과로 단정하지 않는다. 반복 읽기 제거와 같은 원관측 통과는 직접 확인했다.

## 최소안과 안전 경계

context-json-cache.patch는 readJson에만 transaction context 캐시를 추가한다. 최초 실제SHA검증→재귀freeze된 JSON 저장, 같은절대경로의 해시충돌 거절, cache hit 전 repository 경계 확인을 수행한다. 전역 캐시·replay결과 캐시·Ajv 캐시는 추가하지 않는다. 원시/schema/security/ground/합산/기대커버/95%분모 조건은 그대로다.

마지막 assertEfficientEvidenceUnchanged는 캐시 대신 실제 파일을 다시 읽어야 한다. 현재 runner guards, seal-results:242/277, promote_cpa_v3:119 및 validatePromotionLedger 마지막 guard가 이를 수행한다. cache hit는 검증 당시 snapshot의 재사용이며 현시점 파일 불변 확인 자체가 아니다. 첫parse 뒤 변조는 마지막guard에서 완료/쓰기 전에 거절된다. 기존 batch memo와 같은 transaction 경계다.

격리6검사 통과: 최초1회읽기·deep-freeze, 해시충돌, 마지막실바이트변조, 새context변조검출, repo외경로, 같은20원관측 replay·최종guard. 기존 증거·timeout·모델 요청·엔진 점수는 변경하지 않았다. 우회용 --preserve-source를 사용하지 않는다.

제안은 측정 당시 미적용이었다. B가 인계 문서를 쓰기 직전 현재 consumer가 제안과 같은 f560022e…로 변경된 것을 감지해 알렸다. B는 공통 파일을 수정하지 않았고, 이 보고서는 변경 전후 측정 증거를 구분해 보존한다. 총괄 적용 후 전체 회귀·타입·lint·스테이징 실제시간이 남은 확인이다. 8grading 의존성과 요청은 바뀌지 않아 이 캐시만을 이유로 모델을 재호출할 필요는 없다.
