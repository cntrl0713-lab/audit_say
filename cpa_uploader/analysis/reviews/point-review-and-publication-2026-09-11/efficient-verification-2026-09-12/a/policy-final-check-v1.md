# 공통 정책과 링크 최종 점검

agent plan_foundations가 2026-09-12T04:19:16.573Z에 핵심 정책 7파일과 연결된 wiki 5파일의 관련 절, 자료 관리·SCHEMA를 대조했다. 이 기록은 문서 정합성 검토이며 실제 채점·사람 확인·운영 DB 완료 증거가 아니다.

핵심 정책 충돌은 없었다. 연결된 수동 wiki 네 파일의 과거 엄격 경로 설명에는 적용 범위가 불명확한 부분이 있어 총괄의 추가 승인에 따라 최소 명료화했다. 최종 확인 범위의 미해결 정책 충돌은 0건이다.

| 확인 항목 | 결과 |
| --- | --- |
| deviation_scope | 물음별 ±1점·대표 95%는 실제 채점 일관성의 관측 목표이며 모든 답안 정확도나 내용 오류 허용률이 아니다. |
| foundation_no_unresolved_errors | wiki·기준서 해석·발문·모범답안·배점·QA 기대값에 허용 오류율을 적용하지 않으며 미해결 결함·미확인 출처가 있으면 높은 채점 통과율로 게시하지 않는다. |
| integer_independent_points | 열거는 실제 독립 요소, 서술은 독립 의미 단위, 판단과 근거는 구별하여 기본 1점 정수 합산한다. 부분 누락 때문에 전체를 0점 처리하지 않는다. |
| no_duplicate_or_mechanical_split | 동일 의미·포함 관계 표현을 중복 배점하거나 단어·조건을 기계적으로 쪼개지 않으며 원문·발문의 별도 요구 여부로 판단한다. |
| point_proportionality | 물음마다 최소 충분 답안·설명 및 추론 부담·유사 요구 점수를 대조하고 유지/조정/분리 이유를 기록한다. 산술 합계만으로 타당성을 확정하지 않는다. |
| learning_style | 기준서형 독립 풀이·사례형 부모 사실·주제 검색 후 사례 전체 물음 유지가 일치하며 학습 유형과 답안 type을 구분한다. |
| agent_model_human_separation | agent 전수 내용 대조, 선택적인 별도 API 의미검수, Luna 실제 대표 채점, 실제 사람 확인과 사용자 게시 승인을 각각 구분한다. |
| representative_expected_contract | 모범답안은 저장 바이트 그대로, 부분정답은 0점과 만점 사이, 오답은 0점이며 대표 선정·합산·커버 검사를 호출 전에 수행한다. 1점 물음은 모범·오답 2종이다. |
| expected_grounding | 평가 대상 명칭과 필요한 판단·행위를 구분하고 기대값을 원문과 최소 충분 명제로 정한다. 출력에 맞춘 기대값 변경을 금지하며 정당한 정정은 옛 입력·관측을 보존한다. |
| cost_security_errors | 실행·형상·보안·인용 귀속 오류는 ±1/5%로 면제하지 않는다. Luna·사용자 예산을 유지하고 허용 편차 제거를 위한 자동 반복을 금지한다. |
| evidence_reuse | 원 기대값·raw·엄격 판정을 보존하며 재사용은 실제 입력·모델·동작 동일성 및 재처리를 확인한다. 누락 usage는 unknown이고 재처리는 새 유료 호출로 세지 않는다. |
| default_vs_legacy | 공통 지침의 효율 기본 경로와 기준별 전수 모델 receipt 선택 경로를 구분한다. 연결된 수동 wiki 네 파일에도 이를 명시하여 엄격 경로 요건이 효율 경로로 확대되지 않도록 보완했다. |

## 최소 문서 보완

| 파일 | 처리 |
| --- | --- |
| [question-output-schema.md](../../../../../wiki/question-generation/question-output-schema.md) | 신규 승급의 --review·실제 사람 검수 요건 앞에 효율 경로와 이후 엄격 receipt 설명의 적용 범위를 명시했다. |
| [llm-question-generation-prompt.md](../../../../../wiki/question-generation/llm-question-generation-prompt.md) | 생성 이후 검증을 선택 경로로 구분하고 별도 의미검수·사람 근거 요구를 엄격 경로 선택 시에 한정했다. 생성용 템플릿 내부 규칙은 그대로다. |
| [source-authoring-design.md](../../../../../wiki/question-generation/source-authoring-design.md) | §7에 일반 오류 원칙은 공통, 분할 모델 의미검수·두 model transport 요건은 엄격 경로라는 적용 범위를 명시했다. |
| [question-generation-workflow.md](../../../../../wiki/question-generation/question-generation-workflow.md) | 기존 승인 문항 재검수 문단에서 효율 경로의 재사용·승급과 엄격 경로의 기존 새 receipt·실측 명령을 구분했다. |

기존 엄격 경로의 명령·receipt 수락 요건은 유지했고, 효율 경로의 별도 증거·사용자 게시 승인과 실제 사람의 내용 확인을 구별했다. 발문·모범답안·배점·QA·코드·잠금·과거 실행 기록은 바꾸지 않았다.

## 로컬 확인

- Markdown 링크 77개(명시 헤딩 앵커 포함), wikilink 66개: 누락 0.
- 실제 YAML sources 9개: 누락 0. 수정한 4파일의 날짜·reviewed 형상·최소 2 outbound wikilink 확인.
- API 0회, DB 0회. 전체 테스트 및 wiki 재생성은 실행하지 않았다. 총괄이 최종 정본 변경 뒤 wiki:build/wiki:check와 변경 기록을 일괄 처리한다.
- 일반/과거 경로의 환경 모델 설정 설명은 명시된 Luna 고정 정책을 바꿀 권한이 아니다.

입력 SHA-256, 정책 근거 행, 전후 해시와 링크 전수 결과: [상세 JSON](policy-final-check-v1.json).
