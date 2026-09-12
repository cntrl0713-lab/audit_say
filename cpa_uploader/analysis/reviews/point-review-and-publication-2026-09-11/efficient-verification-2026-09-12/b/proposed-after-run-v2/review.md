# 후속 재사용 스냅샷 선택 수정안 — 미적용

현재 실행과 원 관측은 변경하지 않았다. API 호출은 0회다. 수정안은 원 manifest와 같은 폴더의 정확한 runtime-snapshots.json 경로를 유일하게 선택한다. 활성 consumer의 2줄을 4줄로 바꾸며 나머지 원문은 바이트 그대로 유지한다.

현재 candidate-v3 manifest에는 candidate-v1 인덱스(18개)가 먼저 있고 자신의 인덱스(20개)가 뒤에 있다. 기존 suffix-first 선택은 원 실행 code20 중 consumer, runner, contract, prepare-resume-v3, seal의 5개를 이전 인덱스에서 찾지 못한다. 같은 폴더의 인덱스는 20개 전부의 경로·해시·보존 바이트와 일치한다.

## API 없는 확인

13개 검사 통과. 기존 코드의 실제 run-v2 원 관측 거절을 재현하고, 제안 코드로 같은 원 관측을 production raw/schema/ground/score 경로에서 재생했다. 이전 run-v1 관측 재사용도 유지된다. 이 검사는 새 실제 채점이나 게시 receipt가 아니다.

인덱스 순서 변경, 정확한 형제 인덱스 누락, 동일 경로 중복, 정규화된 별칭 중복, 하위폴더 인덱스 위장, 원 기대점수 변경, worker 변경, 원 관측의 origin을 중간 manifest로 바꾸는 경우를 검사했다. 정당한 두 원 실행은 통과하고 변경·모호성은 거절된다. 전체 origin.inputs 해시 검사와 code_files20의 보존본 검사는 계속 수행한다.

## 다음 manifest 조립 시 유지할 경계

- 새 manifest와 동일 폴더의 runtime-snapshots.json을 inputs에 정확히 한 번 포함한다. 과거 인덱스들도 이전 inputs/관측의 증거로 그대로 보존한다. 기존 suffix 선택의 우회로 inputs의 순서만 바꾸는 방식은 사용하지 않는다.
- 재사용 관측은 실제 observation.manifest를 origin_manifest로 계속 지정한다. run-v1 관측을 run-v2의 summary가 참조한다고 해서 origin을 candidate-v3으로 재라벨하지 않는다. 새 run-v2 관측만 candidate-v3을 origin으로 가진다.
- 04-007 partial은 원 기대의 정정 및 유효 부분답 선정으로 entry가 달라지므로 이전 관측을 재사용하지 않는다. 과거 답안·기대표·실측은 보존하고 새 선정 답안/기대에 한 번만 요청한다. 이 제안은 기대값 변경까지 재사용 범위를 넓히지 않는다.
- 전체 entry 비교에는 answers/expected_by_subquestion/selection_evidence/worker가 포함된다. 다른 entry를 내용 변화 없이 재사용하려면 그 객체를 그대로 이어받는다. 설명만 바꾼 selection_evidence도 현재 exact 계약에서는 새로운 entry다.
- 새 동결 runtime에는 이 consumer 수정의 새 해시·보존본을 포함한다. 현재 여덟 grading dependency는 같은 바이트여야 한다. 기존 run-v1/run-v2의 runtime 또는 인덱스 해시를 덮어쓰지 않는다.
- 최종 관측 집합에 포함된 재사용 비용은 한 번만 집계한다. 기대 정정으로 제외된 과거 관측 비용은 실제 총지출 장부에 별도 보존하며 최종 95% 분모를 줄이는 근거로 사용하지 않는다.

원 응답 replay, 보안·형상·점수 검증의 추가 완화는 제안하지 않는다. 활성 실행 종료 후 총괄이 patch 적용·대상 회귀·새 입력 잠금을 수행해야 한다.
