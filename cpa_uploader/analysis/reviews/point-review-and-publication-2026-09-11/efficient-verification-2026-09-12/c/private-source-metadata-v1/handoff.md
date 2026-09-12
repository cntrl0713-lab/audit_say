# 비공개 문항 메타데이터 복원: 로컬 마감 및 중지

운영 DB의 복원 마이그레이션은 **아직 미적용**이다. 사용자 중지 지시에 따라 현재 진행하던 로컬 검사와 이 인계 기록만 마쳤다. 이 작업에서는 운영 DB 쓰기·추가 원격 조회·모델 API 호출을 수행하지 않았다. 최종 사후 검증은 완료 상태가 아니다.

## 확인한 결함과 보완

기존 운영 사후 검사에서 37세트의 비공개 DTO가 원문 투영과 달랐다. 332개 차이는 `source_refs[*].source_span` 319개와 `criteria[*].critical_facts[*].scope` 13개의 누락이다. 특히 scope는 실제 채점 입력에 전달하는 허용 범위이므로 비교에서 제외하지 않는다. 원래 은행/source_document에는 두 필드가 보존되어 있다. 원래 실패 영수증과 전체 차이 조사는 상위 `db-publication-v4/verification.json`, `private-projection-diagnosis-all-v1.json`에 그대로 남아 있다.

새 파일 `supabase/migrations/20260912060000_cpa_private_source_metadata.sql`은 `cpa_get_question_version_with_source_metadata(uuid)`를 추가하고 서비스 전용 `cpa_get_question_version(uuid)`만 이 보강 함수를 사용하게 한다. 기존 정규화 document getter, public/membership 경로, 정규화 행, 봉인 원문과 과거 마이그레이션은 수정하지 않는다.

- 정확한 version에 연결된 모든 active/retired release의 set ID·배열 위치·봉인 상태·source 파일 SHA를 확인한다.
- 원 import와 동일한 PostgreSQL JSONB 해시를 재계산한다. 상태와 검토 상태만 제외하고 저장된 applicability를 포함한다.
- 원문에 연결된 여러 release가 있으면 전부 대조한다. 최신 한 개만 선택하거나 깨진 원문을 legacy fallback으로 숨기지 않는다. 연결된 비어 있지 않은 원문이 0개인 legacy만 기존 DTO를 유지한다.
- 일반 필드도 정규화 DTO와 대조한다. 발문·모범답안·명제·배점·원문 인용·requirement의 source_span 등이 다르면 덮어쓰지 않고 오류로 중지한다.
- source ID 및 물음→criterion→fact ID로 두 optional 필드만 복원한다. ID 중복/누락, 잘못된 타입, 기존 metadata와 충돌을 거부한다. optional null은 기존 strip-null 계약의 absent이고 빈 문자열은 보존한다.
- 서비스 역할만 비공개 함수를 실행한다. public DTO에 정답/기준을 추가하지 않는다.

## 완료한 검사

`migration.test.ts`는 실제 신규 SQL을 PGlite에서 실행한다. 첫 전체 검사 `migration-test-v1.log`는 **40/40 통과**했다. 실제 production import로 현재 154세트와 이전 운영 104세트를 넣고, 별도 합성 관계에서는 정상 제약이 막는 손상 상태를 주입해 오류 경계를 검사했다.

이후 SQL을 바꾸지 않고 채점 입력 비교를 강화했다. `migration-test-v2.log`의 대상 검사 **1/1 통과**는 현재 154 + retired 104 = **258세트**를 다시 대조했다. 모든 private DTO가 원문 투영과 일치하고, `buildGradingPrompt`의 payload JSON 전체 값·배열 순서는 deepEqual, JSON 밖 지시문·출력 예시는 exact였다. JSONB 객체 키 순서 차이 때문에 **전체 prompt 원바이트 동일성을 주장하지 않는다**.

현재 은행의 source_span 319개·scope 13개를 복원했으며, 정규화/원문 테이블 8개, 보호 함수 6개와 public payload는 전후 불변이었다. 별도 대상 lint와 전체 TypeScript 검사도 exit 0이다. 최종 테스트 파일의 전체 40개를 다시 실행한 것은 아니며, 마지막 수정은 payload 대조 추가이고 그 영향을 받는 실제 은행 검사를 재실행했다. 파일 해시·명령·상태는 `handoff.json`에 고정했다.

## 재개 시 남은 작업

1. 이 인계의 SQL·입력 해시와 현행 운영 release/함수/권한을 읽기 전용으로 재확인한다. 사용자 중지 이후 다른 변경이 있으면 원인부터 대조한다.
2. 총괄의 승인된 적용 도구에서 기존 함수 정의/권한과 데이터 상태를 백업하고, 새 마이그레이션만 트랜잭션으로 적용한다. 현재 원문·정규화 행·release·봉인 기록은 갱신하지 않는다. 이 단계는 이번 인계에서 실행하지 않았다.
3. 현재 active 154개뿐 아니라 모든 sealed version의 private DTO를 조회하여 두 metadata 외 일반 필드와 public payload가 그대로인지 확인한다. 원문 있는 오류를 무시하지 않는다. 실제 운영 데이터에서의 이 전수 확인은 아직 미실행이다.
4. 복원한 private DTO의 전체 grading payload 값/배열 순서 및 JSON 밖 지시문을 원문과 대조한다. 원 모델 실행 기록·점수·원 기대값을 다시 쓰지 않는다. 이번 로컬 대조만으로 새 모델 검수나 사람 확인을 주장하지 않는다.
5. 원래 실패 `verification.json`을 보존하고 새 경로 `verification-v2.json`으로 전체 사후 검증을 수행한다. 새 migration 적용 증거를 별도로 연결한다. 실패가 남으면 운영 적용 완료와 사후 검증 완료를 구분한다.

위 후속 단계에는 착수하지 않았으며, 이 인계 뒤 작업을 중지한다.
