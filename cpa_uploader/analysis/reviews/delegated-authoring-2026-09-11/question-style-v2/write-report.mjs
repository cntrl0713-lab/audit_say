import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const work = `${control}/question-style-v2`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const index = read(`${work}/index.json`), validation = read(`${work}/validation.json`), manifest = read(index.manifest_file);
const c = index.counts;
const reportFile = 'docs/reports/question-authoring-by-topic-2026-09-11/T08-C-물음-분할과-기준서형-사례형-분리.md';
const link = (from, to) => path.relative(path.dirname(from), to).replaceAll('\\', '/');
const rows = [...index.entries].sort((a, b) => index.topic_order.indexOf(a.topic_id) - index.topic_order.indexOf(b.topic_id) || a.plan_id.localeCompare(b.plan_id) || a.display_number - b.display_number);
const table = ['| 주제 | 세트 | 원 물음 ID | 학습 분류 | 배점 | 판단 근거 |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.topic_id} | ${row.plan_id} | ${row.subquestion_id} | ${row.style === 'standard' ? '기준서형' : '사례형'}${row.mixed ? '(기준서 설명 포함)' : ''} | ${row.points} | ${row.reason.replaceAll('|', '\\|')} |`)];
fs.writeFileSync(`${work}/classification-report.md`, '# 기준서형·사례형 최종 분류 대조\n\n' +
    `원 ${c.source_sets}세트·${c.questions}물음 → ${c.learning_groups}개 학습 문제 묶음. 기준서형 ${c.standard}, 사례형 ${c.case}.\n\n` + table.join('\n') + '\n', { flag: 'wx' });
fs.writeFileSync(reportFile, `# T08-C 물음 분할과 기준서형·사례형 분리\n\n` +
    `사용자 확정 기준은 **주어진 사실관계와 연계해 답해야 하면 사례형, 기준서만으로 답할 수 있으면 기준서형**이다. 사실관계가 있는 학습 문제에는 사례형 물음만 배치하고 기준서형은 지문 없는 별도 문제로 구성했다.\n\n` +
    `T08-C의 기존 물음2(17점)를 업무 이해·발견사항/결론 평가 8점과 가정·방법·사용자료 검토 9점으로 분리했다. 기존 criterion ID와 정답 명제는 그대로이며 새 물음 ID는 sub4다. 원본의 sub3 불일치 대응은 유지했다. 원 세트 총점은 22점이고, 학습 화면에서는 사례형 1물음·3점과 기준서형 3물음·19점으로 별도 구성한다.\n\n` +
    `기존 49세트의 물음 수는 131→132이며 총점은 521점이다. 물음별 재분류 결과는 기준서형 **${c.standard}개**, 사례형 **${c.case}개**이며 ${c.learning_groups}개 학습 문제 묶음으로 구성했다. 기준서형 중 사례를 가리키던 표현은 ${c.changed_sets}세트·${c.changed_prompts}발문에서 독립적으로 읽히도록 정리했다. 특정 초안·대상·날짜·팀원 제안을 해석해야 하는 요구는 사례형으로 남겼다.\n\n` +
    `[분리된 기준서형 목록](http://127.0.0.1:3000/quiz/draft-preview/catalog?style=standard) · [사례형 목록](http://127.0.0.1:3000/quiz/draft-preview/catalog?style=case) · [T08-C 기준서형](http://127.0.0.1:3000/quiz/draft-preview?set=pilot-08-008&style=standard) · [T08-C 사례형](http://127.0.0.1:3000/quiz/draft-preview?set=pilot-08-008&style=case)\n\n` +
    `## 근거와 검증 범위\n\n` +
    `- [132물음 분류 근거](${link(reportFile, `${work}/classification-report.md`)}) 및 [현재 학습 묶음](${link(reportFile, `${work}/learning-groups.json`)}). 기준서형 묶음의 사실관계는 모두 빈 배열이고, 사례형 묶음에는 사례형으로 분류한 물음만 들어 있다. 원본 ID·인용·정답·배점의 계보는 보존한다.\n` +
    `- [활성 입력·비교 은행](${link(reportFile, index.manifest_file)}): 정본104+초안49의 비교 은행153세트. 정본·공개본은 변경하지 않았다.\n` +
    `- [입력 검사](${link(reportFile, `${work}/validation.json`)}): 전체 물음 누락·중복, 직접 인용·형상·계획, 정답·criterion·QA 원답안 보존과 메모리 비교은행 검사를 통과했다. 저장 기대판정 합산은 실제 모델 판정과 구별한다.\n` +
    `- T08-C는 원 QA158개에서 분할 투영과 새 물음별 대조를 포함한276개를 준비했다. 전체 활성 작성자QA는 ${manifest.author_qa_cases}개다. [독립 분할 검토](${link(reportFile, `${control}/question-style-v1/t08-c-independent-review.md`)})에서 8/0과0/9의 범위 경계도 대조했다.\n` +
    `- 세트당 2~3개였던 입력·생성 제한을2~4개로 맞췄다. 관련 회귀검사21개는 오프라인 fixture이며 실제 출제·게시·모델 호출이 아니다. 상세 최종 검사와 파일 해시는 [검증 기록](${link(reportFile, `${work}/final-verification.json`)})에 기록한다.\n\n` +
    `실제 모델 의미검수·채점은 이번 변경에 대해 실행하지 않았다. 이전 HTTP429 이후의 API 중지 상태를 유지하며, 과거 receipt를 새 발문·구조에 승계하지 않는다. 재개에는 현재 입력과 코드로 새 실행 잠금·출력 경로가 필요하다. 정본 편입·게시·배포는 수행하지 않았다.\n\n` +
    `업무 이해의 네 측면이 발문에 제시된 확인형 성격은 분할로 바뀌지 않는다. 8점·9점은 현재 학습용 채점요소의 합계이며 공식 시험 배점이라는 뜻은 아니다.\n`, { flag: 'wx' });
fs.writeFileSync(`${work}/README.md`, `# 기준서형·사례형 분리 후속 v2\n\n` +
    `사용자 최신 정의에 따라 사례와의 실제 연계 필요 여부를 재대조했다. **기준서형 ${c.standard}물음 / 사례형 ${c.case}물음**, 원49세트·132물음을 ${c.learning_groups}개 학습 문제 묶음으로 나누었다. 사실관계가 있는 묶음에는 사례형만, 기준서형 묶음에는 독립 발문만 들어 있다.\n\n` +
    `- [적용 보고](${link(`${work}/README.md`, reportFile)})\n- [분류 근거](classification-report.md) · [분류 입력](index.json) · [학습 묶음](learning-groups.json)\n- [현재 manifest](${link(`${work}/README.md`, index.manifest_file)}) · [입력 검사](validation.json) · [최종 검증](final-verification.json)\n` +
    `- [관계 경로 후속](coverage-followup.json): 과거 snapshot 보존, 관계 검토 대기 유지.\n\n` +
    `compile.mjs가 담당자별 분류 파일과 구조분할 manifest를 읽어 독립 발문 후속본·비교 은행·학습 묶음을 생성한다. 생성 JSON·표는 직접 수정하지 않는다. 기존 question-style-v1과 point-policy-v1의 문항·QA·실측은 당시 근거로 보존한다. 분류/로컬 검사 완료와 실제 모델 검증/사람 확인 완료를 구분한다. API0, 편입·게시·배포 없음.\n`, { flag: 'wx' });
fs.writeFileSync(`${control}/question-style-v1/README.md`, '# 최초 학습 분류와 구조 분할 기록\n\n사용자의 추가 정의 전 최초 분류83/49와 T08-C의 구조 분할 기록을 보존한다. 현재 선택은 [v2 후속](../question-style-v2/README.md)이며 이 폴더의 결과를 현재 분류로 사용하지 않는다.\n', { flag: 'wx' });
writeIdLedger();
function writeIdLedger() {
    const original = `${control}/id-ledger.json`;
    const t08 = manifest.entries.find(entry => entry.plan_id === 'T08-C');
    fs.writeFileSync(`${work}/id-ledger-followup.json`, JSON.stringify({ predecessor: { file: original, sha256: hash(original) },
        new_subquestion: { plan_id: 'T08-C-Q4', set_id: 'pilot-08-008', id: 'sub4', origin: 'sub2 criteria 9..17', points: 9 },
        source_display_order: t08.question_ids, learning_group_ids: ['pilot-08-008--case', 'pilot-08-008--standard'],
        note: 'Existing set/subquestion/criterion IDs preserved; learning group IDs are presentation identifiers, not published question-bank IDs.' }, null, 2) + '\n', { flag: 'wx' });
}
assert.equal(validation.errors.length, 0);
console.log(JSON.stringify({ reportFile, ...c }));
