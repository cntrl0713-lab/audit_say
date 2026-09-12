# 물음별 유형·주제 DB 개편

대상은 기존 정본의 모든 물음과 최신 49개 초안이다. 기준서형은 물음 하나로 풀이하고 사례형은 사실관계 부모에 연결한다. 주제 검색은 사례를 찾는 데 사용하며 검색된 사례에 속한 모든 사례형 물음을 함께 보여준다. 상세 계약은 [공통 문서](../../../../docs/물음별-학습-단위와-분류-계약.md)를 따른다.

## 입력과 분류

- [정본 분류](canonical-classification.json): 104원문 세트·212물음, 기준서형208·사례형4, 독립 발문 보완7, 다주제38. [판정 근거와 과거 판본 대조](canonical-classification.md).
- [초안 분류](draft-classification.json): 최신49원문 세트·132물음, 기준서형64·사례형68, 다주제51. [초안 판정 근거](draft-classification.md). 정본 편입·게시를 의미하지 않는다.
- [정본 독립 검토](canonical-independent-review.md): 전212발문·사실 읽기와49물음126criterion의 경계 대조. 확정 유형 오류 없음. 사람 확인이나 실제 모델 의미검수로 기록하지 않았다.
- [원격 변경 전 스냅샷](remote-before.json): 두 릴리스,109원문 판본·222물음 판본. 학습자 개인정보·답안은 조회하지 않았으며 집계상 풀이·채점·경험치 기록은0건이었다.

원본 정본·공개본·49초안·기존 receipt는 덮어쓰지 않는다. 현재 파일 모드 분류는 수동 원장을 `scripts/build-learning-unit-catalog.ts`로 생성한 `cpa_uploader/data/learning-question-classifications.json`이다. 생성 파일을 직접 수정하지 않는다.

## 실행·검증 증거

- [최초 독립 구현 검토](implementation-independent-review.md)와 [수정 후 독립 재검증](implementation-independent-followup.md). SQL의 유형·사실관계 계약 누락과 신규 분류 불일치를 수정하고 원자적 롤백을 확인했다.
- [실데이터 격리 DB 리허설](rehearsal.json):222개 물음 판본의 분류, 전체 원문·공개문서 보존, 분류 재등록 멱등성, 활성212물음의 단위 구성 검사.
- [전체 테스트 로그](test-suite.log):462개 통과. 모델 API 호출을 사용하지 않은 코드·격리 DB·오프라인 fixture 검사다.
- [이관 계획 v2](rollout-plan-v2.json): 기존·과거 릴리스의 전수 분류, 실제 DB 원본 해시,6개 제출·회원 RPC 해시 및 migration 바이트를 고정한다. 이전 [계획](rollout-plan.json)은 함수 가드 추가 전 기록이다.
- [실제 적용 receipt](rollout-receipt.json)와 [변경 후 원격 스냅샷](remote-after.json): 2026-09-11 schema·분류 이관 적용. receipt의 사후 검증 대기는 적용 직후 상태이며 후속 검사로 덮어쓰지 않는다.
- [원격 사후 검증 완료](post-verification.json): 109원문·공개 판본 불변, 222물음 판본 전수 분류·봉인, 활성212물음의 유형·주제·부모 조건, RLS·권한·회원권 래퍼 보존 통과. 실제 DB 쓰기나 모델 채점을 추가하지 않은 읽기 검증이다.
- [브라우저 검증](browser-verification.json): 기준서형 단독 풀이, 커리큘럼 링크, 사례형 사실관계, 9점 독립 물음 및 주제 검색 후 사례 전체 물음 표시를 확인했다.
- [사람이 읽는 변경 보고서](../../../../docs/reports/물음별-유형-주제와-독립-풀이-개편.md).

브라우저의 구 세트 전체 제출 임시 답안은 사용자 허용에 따라 현재 사용자·알려진 원본 ID 범위에서 정리한다. 새 학습 단위 제출과 다른 사용자·다른 앱 저장값은 유지한다. 이 허용을 문제은행 모범답안이나 검수 증거 삭제로 해석하지 않는다.

## 명령과 적용 구분

```powershell
npm run learning:catalog:build
npm run learning:catalog:check
npx tsx scripts/migrate-learning-classifications.ts --plan <새 계획 경로>
```

기존 DB에 적용하는 명령은 준비된 계획과 원격 프로젝트·계획 SHA를 명시하는 `--apply` 방식이다. `scripts/migrate-learning-classifications.ts`는 원본·릴리스·RPC가 준비 후 변경되면 거절하며, schema와 모든 분류를 한 트랜잭션으로 적용한다. 재시도는 새 쓰기 전에 실제 DB 완료 상태부터 확인한다. 신규 문제의 게시와 앱 배포는 이 metadata 이관에 포함되지 않는다.

실제 적용 여부는 rollout receipt와 변경 후 검증을 확인한다. 이관 계획이나 로컬 리허설만으로 운영 적용 완료라고 표시하지 않는다. 실제 모델 의미검수·API 채점은 이번 DB 구조 검증 범위에서 실행하지 않았다.
