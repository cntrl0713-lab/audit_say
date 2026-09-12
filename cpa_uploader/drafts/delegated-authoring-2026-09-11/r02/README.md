# R02 — 지배기구 커뮤니케이션 후속본

**1차 상태: draft_ready. 1세트·2물음·12criterion·12점(7+5). 최종 검증은 미완료다.** 대상은 `T05-A` → `pilot-05-008`이며 기존 `draft-05-260-001`의 후속 계보다. 기존 초안이나 release 원본을 별도 신규 세트로 더하지 않는다.

- [후속 문항](pilot-05-008.json), [version 1 계획](pilot-05-008.authoring-plan.json), [요구·출처·차이](scope-and-sources.md)
- [작성자 QA 67행](qa-cases-t05-a.json), [공식 PDF 근거 장부](source-evidence.json), [총괄 등록 source 연결](source-registration-map.json)
- [최신 정적검사 포인터](evidence/phase1/latest-static.json), [과거 51회 전체 판정 대조](evidence/phase1/prior-all-criteria-expectation-check.json), [인계](handoff.md)

기본 사례에 2026년 1월 1일 개시 보고기간을 명시하고, 2027년 CPA 시험 목표 및 판본 한계를 기록했다. 발문·모범답안·criterion ID·배점은 기존 release 후보와 같다. 직접 source는 총괄이 등록한 2026년 공식 전문의 260.16~17과 정확한 locator로 바꾸었다. 출처 packet은 공용 catalog가 고정된 뒤 생성하며 수동 근거 장부를 생성기 packet으로 취급하지 않는다.

과거 receipt의 문항·비교은행·계획·소스 해시는 원본과 일치한다. 과거 의미검수는 `manual_reasoned`이며 실제 모델 의미검수 이력이 아니다. 과거 실제 채점은 `gpt-5.6-luna`의 비어 있지 않은 답안 50회와 전체 빈답안의 모델 미호출 경로 1회다. 현재 채점 코드의 합성 해시가 달라졌으나, 저장 raw 판정을 현재 코드로 다시 처리한 51회는 모두 일치했고 전체 612개 criterion 판정으로 확장해도 불일치가 없었다. 이는 이번의 새 모델 호출을 뜻하지 않는다.

작성자 QA는 기존 51개 실행 입력에 역순·한 문장·무관한 문장·반복 8개와 실제 조건 경계 7개를 더했다. 전체 빈답안을 물음별 2행으로 표현하여 공통 runner 형식상 67행이며, 답안 맵으로 중복을 제거하면 66개다. 모두 이번 실측 전 기대값이다.

기존 원본·과거 receipt·정본·공개본·DB는 수정하지 않았다. 모델 의미검수·현재 버전의 실측·동료 초안 포함 최종 중복 검사는 총괄의 비교은행 확정 후 이어간다. `needs_review / needs_human_review`를 유지한다.
