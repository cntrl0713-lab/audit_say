<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 회계감사·채점 공통 규칙

- 회계감사 용어, 시점, 분류, 예외, 기준서 근거와 임계값을 보존한다.
- 정답 결론과 정답 근거를 구분하고, 부분점수 가능 여부를 문제의 criterion 계약에 따른다.
- AI는 criterion 판정과 답안 인용만 반환한다. 점수 합산·인용 검증·보안 플래그 반영은 코드가 수행한다.
- 답안 원문, 모범답안, source quote가 경계를 넘을 때 public 데이터에 비공개 채점 정보가 노출되지 않는지 확인한다.
- 변경은 작은 단위로 나누고, 함수 시그니처·데이터 형상·검증 규칙을 바꾸면 모든 호출처와 테스트를 함께 갱신한다.
- 타입 검사와 관련 테스트를 실행한 뒤 결과를 보고한다. 실패한 검증을 통과한 것으로 보고하지 않는다.

공급자·모델 이름을 에이전트 역할 규칙에 고정하지 않는다. 출제·채점의 모델 선택은 해당 기능의 환경 설정과 평가 결과로 관리한다.
