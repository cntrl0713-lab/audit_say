import fs from 'node:fs';
import {groups} from './content.mjs';
const batch='cpa_uploader/drafts/standard-followup-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(`${batch}/${f}`,'utf8'));
const index=read('index.json'),receipt=read('verification-receipt.json'),research=read('research.json');
const table=groups.map(g=>`| ${g.id} | ${g.title} | ${g.questions.length} | ${g.questions.reduce((n,q)=>n+q.items.length,0)} | ${g.difference} |`).join('\n');
const out=`# 기준서형 후속 추가 제작 — 2026-09-13

추가 가치가 있는 **${index.counts.questions}물음·${index.counts.points}점**을 ${index.counts.sets}개 관리 묶음으로 제작했다. 모든 물음은 사례 부모 없이 하나씩 독립적으로 풀이한다. 사용자 확정 범위인 감사기준서·윤리·법규와 추가 10~15물음을 이어받았다.

- [문제 14선](문제.md)
- [모범답안·부분점수 기준](모범답안-배점.md)
- [전체 문항 JSON 색인](index.json)

현재 은행 ${research.comparison_scope.canonical_sets}세트·${research.comparison_scope.canonical_questions}물음과 직전 두 배치의 29물음, data·drafts 아래 보존된 변형 ${research.comparison_scope.draft_and_bank_variants}개를 조사했다. 동일 ID의 옛 판본과 현재 판본을 구별하며, 문구 검색 외에 후보와 가까운 기존 물음의 발문·모범답안·criterion을 대조했다. 판본 변형 수를 고유 물음 수로 해석하지 않는다.

| 묶음 | 새 주제 | 물음 | 점수 | 기존 문제와의 차이 |
| --- | --- | ---: | ---: | --- |
${table}

낮은 보수, 기본 법규위반 대응, 전문가·내부감사·서비스조직 이용, 직전 이해상충·제2의견·의무교체 등은 이미 다루고 있어 제외했다. 임의추출의 모든 항목에 추출기회를 주는 원칙은 기존 내용과 일부 겹치지만, 추출방식의 정의·편의 회피·통계적 적용 적합성을 함께 이해하는 데 필요하여 포함했다. [조사 장부](research.json)와 [비교 목록](comparison-inventory.json)에 범위를 남겼다.

요소와 원출제의 의미 대응은 [원발문 검토](coverage-review.json)에 기록하고 초안 대상 관계 6개를 추가했다. 성공보수 안전장치의 2023 기출 1회와 2025 모의 1회, 통계적 표본감사 특성의 2014 기출 1회, 임의추출 적합성의 2016 기출 1회를 구별한다. 특정 교재의 재수록과 OX 수록을 기출 횟수에 더하지 않는다. 나머지 새 요구의 직접 기출빈도는 확정하지 않았으며, 0회·미연결을 미출제 확정으로 표현하지 않았다.

공식 근거는 KICPA 2026년 7월 감사기준서 전문, 2024-12-19 의결 윤리기준 전문, 2025-04-01 시행 외부감사법 제22조이다. 2026-09-13에 판본·현행 조문을 확인했으며, 특정 시험연도의 적용 판본을 별도로 확정한 것은 아니다. 2026년 윤리기준 공개초안은 채택하지 않았다.

- [KICPA 감사기준서 전문](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06)
- [KICPA 윤리기준 전문](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=ethstd03&bltnNo=11735541549550&fileSeq=2&subId=sub06)
- [국가법령정보센터 제22조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027658713)
- [공식 발췌](sources/official-excerpts.txt), [출처·추출 계보](sources/provenance.json), [raw 수집](../../raw/collections/2026-09-13-standard-followup/index.md)

기존 카탈로그의 윤리 240.4 발췌에는 페이지 누락이 있어 그대로 사용하지 않았다. 새 정답·채점기준은 공식 전문의 완결된 문단과 직접 대조했다. 140.7 카탈로그 단위는 140.8 제작을 위한 인접 탐색 위치이며 직접 정답 출처가 아니다. [원문 경계 검토](source-boundary-review.json)에 불완전한 기존 자료와 이번 직접 근거를 구별했다. 과거 발췌·receipt의 바이트는 수정하지 않았다.

전 ${index.counts.questions}물음·${index.counts.points}기준의 발문·답안·출처·정수 부분점수를 담당 agent가 대조했다. [의미검수](agent-review.json)는 별도 유료 API 검수나 사람의 확인이 아니다. 요구·부분정답·서술량과 기존 유사 물음의 배점 비교를 물음마다 기록했다. [사전 대표답안](qa-representatives.json)과 [형상·독립 선택·비공개 필드 제거 검사](preflight.json)를 함께 보존한다.

실제 **Luna 채점 ${receipt.final.unique_cases}건 중 ${receipt.final.strict}건 정확 일치, ${receipt.final.within_tolerance}건 전부 ±1점 이내**였다. 모범답안·대표 부분정답·대표 오답을 물음마다 한 개씩 실행했고, 빈 답안은 API 호출 없이 0점임을 검사했다. 두 1점 과소채점은 발문의 주체 반복 및 모범답안의 보충 설명을 모델이 과도하게 요구한 편차로 검토했다. 기대점수와 원답안을 바꾸지 않았으며 추가 반복 호출도 하지 않았다. 이는 이번 대표답안 집합의 실측 결과이며 모든 향후 답안에 대한 정확도 보장이 아니다.

[검증 receipt](verification-receipt.json)에는 실제 요청·응답 재생, 입력 해시 불변, 모델과 요청 식별자, 사용량을 기록했다. [편차 분석](discrepancy-analysis.json)에는 두 반례와 원문 판단을 남겼다. 실제 응답 ${receipt.api_usage.actual_responses}건, 입력 ${receipt.api_usage.input_tokens.toLocaleString('en-US')}·출력 ${receipt.api_usage.output_tokens.toLocaleString('en-US')}토큰이며 캐시 토큰은 receipt에 별도 기록했다. 금액 상한은 사용자 지정이 없었고 비용은 미계산으로 표시했다.

분석·wiki 재생성 및 검사, raw 보존 검사, 배치 링크·정본 해시 확인은 [완료 검사](completion-checks.json)에 기록했다. 기존 wiki의 긴 페이지 경고는 새 문항의 검사 오류와 구별한다.

현재 상태는 **의미검수와 실제 채점을 마친 초안**이다. 사람 확인·정본 편입·학습 DB 반영·운영 배포는 수행하지 않았다. 실행 입력과 과거 증거를 보존한다.

편집 정본은 이 배치의 content.mjs이며 build.mjs가 JSON·문제·답안·계획·대표답안을 생성한다. 기존 grading/run-v1 입력을 바꾸는 재실행은 새 실행 버전으로 관리한다.
`;
fs.writeFileSync(`${batch}/README.md`,out);
console.log(JSON.stringify({readme:`${batch}/README.md`,questions:index.counts.questions,points:index.counts.points}));
