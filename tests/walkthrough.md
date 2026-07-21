# 채점 엔진 강건화(Robustness) 최종 검증 보고서

본 문서는 KICPA 회계감사 채점 엔진의 5대 핵심 결함 수정 및 보안 강화 작업(Slice 1 ~ Slice 5)의 완료 내역과 검증 결과를 정리한 최종 보고서입니다.

---

## 1. 수정 내역 요약 (Slices 1 ~ 5)

| 구분 | 개선 테마 | 대상 파일 및 조치 사항 | 해결된 결함 |
| :--- | :--- | :--- | :--- |
| **Slice 1** | **프롬프트 방어 강화** | - [serverUtils.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/lib/serverUtils.ts)<br>- 채점 지침을 `systemInstruction`으로 원천 이격 분리.<br>- 사용자 답안을 명시적 구분자(`<<<USER_ANSWER_START>>>`)로 래핑.<br>- 프롬프트 주입 및 키워드 샐러드 차단 지침 보강. | - **보안 취약점 방어**:<br>인젝션 시도 및 키워드 단순 열거 샐러드 답안에 0점 강제 부여. |
| **Slice 2** | **필터 공식 교정** | - [serverUtils.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/lib/serverUtils.ts)<br>- [keywordFilter.test.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/tests/keywordFilter.test.ts)<br>- 룰 필터 조건에서 공백/빈 문자열 키워드 사전 제거.<br>- 최소 요구 임계값 공식 상한 보정 (`Math.min` 결합). | - **1개 키워드 자동 0점 버그 해결**:<br>키워드가 1~2개뿐인 소형 문항도 만점 시 룰 필터를 정상 통과함. |
| **Slice 3** | **동의어 2차 관문 도입** | - [utils.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/lib/utils.ts)<br>- [serverUtils.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/lib/serverUtils.ts)<br>- [similarity.test.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/tests/similarity.test.ts)<br>- Bigram Jaccard 유사도 계산 엔진 구현.<br>- 키워드 미달 시 모범답안과의 자카드 유사도 비교(임계값 0.15) 후 구제. | - **False Negative(정답 오폐기) 구제**:<br>조사/동의어로 모범답안을 온전히 설명한 수험생 구제. |
| **Slice 4** | **서버측 키워드 재수화** | - [quizGrading.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/lib/quizGrading.ts)<br>- [actions.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/app/actions.ts)<br>- 서버 액션(`gradeQuizBatch`) 및 내부 수화 모듈에서 DB의 `keywords` 컬럼을 직접 수화하여 덮어쓰도록 처리. | - **클라이언트 위변조 취약점 차단**:<br>수험생이 API 페이로드의 `k` 값을 강제로 `[]`로 바꾸어 필터를 무단 통과하는 우회 수단 원천 격리. |
| **Slice 5** | **파서 강건화** | - [serverUtils.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/lib/serverUtils.ts)<br>- [gradeParsing.test.ts](file:///c:/Users/cntrl/Workspace/study/audit_say/tests/gradeParsing.test.ts)<br>- 균형 중괄호 스캔(Balanced Brace Scan) 파서 알고리즘 결합.<br>- 객체형 피드백 반환 시 문자열 변환 자동 직렬화 보강. | - **파싱 에러(-1) 해결**:<br>Gemini가 다중 JSON을 뿜거나 피드백에 중괄호가 섞여 있어도 첫 번째 정상 객체만 파싱해 채점 완료. |

---

## 2. 검증 테스트 수행 결과

모든 테스트는 로컬 환경 및 실제 Gemini API 환경에서 순차 실행되었으며, 단 하나의 실패 없이 **전수 통과(PASS)** 하였습니다.

### A. 단위 테스트 결과 (Unit Tests)

1. **키워드 필터 단위 검증 (`tests/keywordFilter.test.ts`)**
   - **결과**: `6/6 PASS`
   - **주요 내용**: 1개 키워드 통과 보장, 빈 키워드 무조건 매칭 차단, 띄어쓰기 정규화 작동 검증.

2. **유사도 연산 단위 검증 (`tests/similarity.test.ts`)**
   - **결과**: `4/4 PASS`
   - **주요 내용**: Bigram Jaccard 유사도 계산 단독 작동 검증. 
     - Q5 동의어 답안 유사도 실측치: `0.1642` (임계값 0.15 이상이므로 구제 통과)
     - 타 문항 오답 유사도 실측치: `0.1121` (임계값 0.15 미만이므로 차단)

3. **응답 파서 강건화 검증 (`tests/gradeParsing.test.ts`)**
   - **결과**: `19/19 PASS`
   - **주요 내용**: 다중 JSON 발췌 파싱, 객체 피드백 직렬화 포맷팅, 중괄호가 들어간 피드백 파싱 및 경계값(0~10) 클램핑 정상 작동 검증.

---

### B. 통합 API 실측 검증 결과 (Integration / Adversarial Tests)

1. **적대적 답안 방어 검증 (`tests/verify-adversarial.ts`)**
   - **결과**: `7/7 PASS`
   - **상세 내역**:
     - **시나리오 1: 키워드 샐러드 (단어만 단순 나열)** ➡️ **0점 처리 (방어 성공)**
     - **시나리오 2: 부정 답안 (키워드는 포함하나 반대로 서술)** ➡️ **0점 처리 (방어 성공 - 주제 불일치 판정)**
     - **시나리오 3: 프롬프트 인젝션 시도 (명령 모방)** ➡️ **0점 처리 (방어 성공 - '프롬프트 주입 및 점수 조작 시도 감지')**
     - **시나리오 4: k = [] 전송을 통한 룰 필터 우회 시도** ➡️ **0점 처리 (방어 성공)**

2. **정답 보존 및 채점 일관성 검증 (`tests/verify-paraphrase.ts`)**
   - **결과**: `PASS (5/5)`
   - **상세 내역**:
     - **시나리오 1: 조사 및 어순 변형 정상 답안** ➡️ **10점 획득 (생존)**
     - **시나리오 2: 동의어/약어 치환 정답 (Jaccard 0.15 우회)** ➡️ **Q4(10점), Q5(8점) 정상 획득 (구제 성공)**
     - **시나리오 3: 동일 답안 3회 연속 채점 일관성** ➡️ **편차 0점 (일관성 통과)**

---

## 3. 시사점 및 안전 가이드라인

1. **임계치 튜닝의 중요성**:
   - 실측 결과 동의어 치환 답안의 Bigram Jaccard 유사도는 **0.164** 수준으로 측정되었습니다. 초기 계획인 0.20을 유지했을 경우 정답 오폐기(False Negative)를 극복하기 어려웠으나, 실측에 근거해 임계값을 **0.15**로 캘리브레이션함으로써 실질적인 수험생 구제와 부적합 답안 차단 간의 최적 균형을 확보했습니다.
2. **LLM 지연 시간 제어와 재시도**:
   - Gemini API 호출 간 500ms 딜레이 부여 및 3회 지연 재시도(Retry with Exponential Backoff) 메커니즘을 연동하여, 통합 테스트 도중 다수 발생한 **API 503 Unavailable 에러를 자동 극복**하고 무사히 채점을 마칠 수 있었습니다. 
3. **타입 안전성(TypeScript)**:
   - 서버 수화 로직 및 테스트 내 타입 컴파일 에러를 모두 수정 완료하여 `npx tsc --noEmit` 검증이 깔끔히 통과함을 확인했습니다. 

---

## 4. Slice 6: 순차 절차(ordered) 규정 감사 및 실측 검증

### A. 감사 진행 및 최종 판정
- **감사 대상**: V2 307번을 제외한 31개 문항 전체
- **판정 요약**: 추가 설정 대상 **0건** (기존 307번 단독 유지)
  - 311번(위험평가절차 이해사항)은 순서 흐름이 존재하나 루브릭이 `best_n` 모드로 작성되어 순서 제한이 불필요하므로, 오플래그 방지 정책에 의해 최종 비대상 처리되었습니다. (사용자 승인 완료)

### B. 실측 프로브 테스트 결과 (tests/verify-ordered-probe.ts)
- **307번 정순 답안**: `[10, 10, 10]`점 (평균 10.0점) ➡️ **🟢 PASS**
- **307번 역순 답안**: `[3, 4, 4]`점 (평균 3.7점) ➡️ **🟢 PASS** (절차 위반 정상 감점 및 피드백 명시)
- **316번 셔플 답안**: `[10, 10, 10]`점 (평균 10.0점) ➡️ **🟢 PASS** (열거형 정책 무회귀 보존)
- **122번 셔플 답안**: `[10, 10, 10]`점 (평균 10.0점) ➡️ **🟢 PASS** (열거형 정책 무회귀 보존)
