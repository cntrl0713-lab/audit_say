import fs from 'node:fs';
import {groups} from './content.mjs';
const batch='cpa_uploader/drafts/standard-additional-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(`${batch}/${f}`,'utf8'));
const index=read('index.json'),receipt=read('verification-receipt.json'),research=read('research.json');
const publication=fs.existsSync(`${batch}/publication-v2/app-verification.json`)?read('publication-v2/app-verification.json'):null;
const table=groups.map(g=>`| ${g.id} | ${g.title} | ${g.questions.length} | ${g.questions.reduce((n,q)=>n+q.items.length,0)} | ${g.difference} |`).join('\n');
fs.writeFileSync(`${batch}/README.md`,`# 기준서형 신규 요구 추가 제작 — 2026-09-13

${publication ? '**정본·운영 앱 반영 완료.** 13물음·62점을 게시하고 운영 학습 DB 및 /curriculum·/quiz에서 조회를 확인했다. [게시·앱 확인 기록](publication-v2/app-verification.json), [운영 DB 등록 영수증](publication-v2/db-applied.json), [승급 근거](publication-v2/batch.json)를 참조한다. 아래 제작·채점 수치는 초안 당시 기록이며 과거 원응답은 보존했다.' : '현재 초안의 제작·검증 기록이다.'}

기존 은행과 앞선 초안에서 다루지 않은 요구를 골라 **${index.counts.questions}물음·${index.counts.points}점**을 제작했다. 관리 파일은 ${index.counts.sets}개이며, 각 물음은 사례 부모나 다른 물음 없이 독립적으로 풀이한다. 사용자 확정 범위인 감사기준서·윤리·법규, 추가 10~15물음, 새 요구 중심의 기준서형을 적용했다.

- [문제 13선](문제.md)
- [모범답안·배점·부분점수](모범답안-배점.md)
- [전체 문항 JSON 색인](index.json)

조사 당시 은행 ${research.comparison_scope.canonical_sets}세트·${research.comparison_scope.canonical_questions}물음, 앞선 세 배치의 43물음, data·drafts의 보존 판본과 진행 중 초안을 조사했다. [비교 목록](comparison-inventory.json)의 ${research.comparison_scope.draft_and_bank_variants}개는 세트의 판본 변형 수이며 고유 물음 수가 아니다. 후보마다 가까운 기존 물음의 발문·모범답안·criterion을 대조했다. 기존 사례형의 핵심 요구를 독립형으로 재포장하는 후보는 제외했다.

| 묶음 | 새 주제 | 물음 | 점수 | 기존 문제와의 차이 |
| --- | --- | ---: | ---: | --- |
${table}

선행 배치의 성공보수·기밀정보 공개·외부감사법 제22조·표본추출 등과 현재 은행의 계약서 내용·고유한계·특수관계자 계약 검사·전문가 이용 등은 제외했다. 법규도 탐색 범위에 포함했지만 이번 선별에서는 기존 법규 물음을 반복 추가하지 않았다. 후보 제외 및 인접 물음과의 차이는 [조사 장부](research.json)에 남겼다. 학습 문서는 주제 01 윤리 → 02 기초 → 03 수임 → 04 문서화 → 11 특수관계자 순이다.

[원발문 검토](coverage-review.json)에 근거하여 초안 대상 관계 3개를 기록했다. 선물·접대의 경미성 판단은 2022년 문제 1 물음 2의 ③, 기준 이탈 문서화는 2022년 문제 2 물음 6의 ④와 대응한다. 의뢰인 자산 보관 안전장치는 교재 원발문·해설을 확인했으나 실제 시험 식별은 미확정이다. 재수록을 출제 횟수에 더하지 않았고, 추가된 요구 전체의 기출빈도나 미출제를 확정하지 않았다.

공식 근거는 KICPA 2026년 7월 개정 감사기준서 전문과 2024-12-19 의결 윤리기준 전문이다. 2026-09-13 공식 게시 목록을 확인했으며 특정 시험연도의 적용 판본을 별도로 확정한 것은 아니다. 2026년 9월 윤리기준 공개초안은 확정 규정으로 적용하지 않았다.

- [KICPA 감사기준서 전문](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06)
- [KICPA 윤리기준 전문](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=ethstd03&bltnNo=11735541549550&fileSeq=2&subId=sub06)
- [공식 발췌](sources/official-excerpts.txt), [출처·추출 계보](sources/provenance.json), [raw 수집](../../raw/collections/2026-09-13-standard-additional/index.md)

선물·접대 일반 규정과 감사·인증의뢰인의 별도 독립성 규정, 법정 재무보고체계와 법정 보고서 문구, 관련 요구사항의 이탈과 목적 미달성을 구별했다. 특수관계자 관여 가능성을 질문하는 단계에서 특수관계자 거래라고 단정하지 않는다. 적용자료·각주·의존 문단을 포함한 [원문 경계 검토](source-boundary-review.json)를 보존했다.

전 ${index.counts.questions}물음·${index.counts.points}배점 기준을 담당 agent가 공식 근거와 대조하고, 물음마다 독립 풀이·주제·부분정답·배점 타당성을 기록했다. [의미검수](agent-review.json)는 별도 유료 API 의미검수나 사람 확인이 아니다. [사전 대표답안](qa-representatives.json)과 [형상·독립 선택·비공개 필드 제거 검사](preflight.json)를 함께 보존했다.

실제 **Luna 채점 ${receipt.final.unique_cases}건 중 ${receipt.final.strict}건 정확 일치, ${receipt.final.within_tolerance}건 전부 ±1점 이내**였다. 물음마다 모범답안·부분정답·오답을 한 건씩 실행했고 빈 답안은 API 호출 없이 0점임을 검사했다. 1점 과소채점은 법정 감사보고서 문맥의 ‘감사’를 ‘재무제표감사’로 인정하지 않은 모델의 축약 표현 판정 편차였다. [편차 분석](discrepancy-analysis.json)에 원답안과 기대점수를 유지한 이유를 기록했으며 반복 호출하지 않았다. 이는 이번 대표답안 집합의 실측 결과이다.

[검증 receipt](verification-receipt.json)는 모든 criterion 기대점수 대조, 실제 요청·응답 재생, 입력 해시, 모델·요청 식별자와 사용량을 포함한다. 응답 ${receipt.api_usage.actual_responses}건, 입력 ${receipt.api_usage.input_tokens.toLocaleString('en-US')}·출력 ${receipt.api_usage.output_tokens.toLocaleString('en-US')}토큰을 기록했다. 캐시 사용량은 receipt에 별도로 남겼다. 사용자 금액 상한은 미지정이며 비용은 미계산으로 표시했다.

초안 완성 당시의 분석·wiki 검사, raw 보존 검사, 관계 현행성, 문서 링크와 정본·실행 입력 보존은 [초안 완료 검사](completion-checks.json)에서 확인한다. 후속 게시 결과는 위의 게시 기록과 구별한다.

${publication ? '현재 상태는 **정본 및 운영 학습 DB 게시 완료**이다. 사용자 게시 승인을 근거로 기존 Luna 응답 39건을 새 수락 형상에서 재처리했고 추가 모델 호출은 없었다. 사람의 직접 내용 검수로 표시하지 않았다. 프런트엔드 재배포 없이 운영 DB 조회 경로에서 새 문항을 확인했다.' : '현재 상태는 **의미검수와 실제 채점을 마친 초안**이다. 사람 확인·정본 편입·학습 DB 반영·운영 배포는 수행하지 않았다.'} 편집 입력은 content.mjs이며 build.mjs가 문항·계획·문제·답안·대표답안을 생성한다. 이미 실측한 입력을 변경하는 후속 검증은 새 실행 버전으로 관리한다.
`);
console.log(JSON.stringify({readme:`${batch}/README.md`,questions:index.counts.questions,points:index.counts.points}));
