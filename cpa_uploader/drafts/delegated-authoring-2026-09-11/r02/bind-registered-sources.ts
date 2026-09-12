import fs from 'node:fs';
import { buildSourceCatalog, sourceUnitToRef } from '../../../questionSourceCatalog.mjs';

const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/r02';
const candidatePath = `${folder}/pilot-05-008.json`;
const planPath = `${folder}/pilot-05-008.authoring-plan.json`;
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const catalog = buildSourceCatalog({ repoDir: process.cwd() });
const refs = ['16', '17'].map(paragraph => {
    const unit = catalog.units.find(unit => unit.file === 'cpa_uploader/data/official/delegated-r02-kga260-2026.txt' && unit.paragraph === paragraph);
    if (!unit) throw new Error(`총괄 등록 공식 260.${paragraph}가 없습니다.`);
    return sourceUnitToRef(unit);
});
const mappings = Object.fromEntries(['src260-16', 'src260-17'].map((id, index) => [id, refs[index]]));
const set = candidate[0];
set.source_refs = refs;
for (const sub of set.subquestions) {
    for (const requirement of sub.requirements) {
        const source = mappings[requirement.source_ref_id] || refs.find(ref => ref.id === requirement.source_ref_id);
        if (!source) throw new Error(`출처 계보가 없습니다: ${requirement.source_ref_id}`);
        requirement.source_ref_id = source.id;
        requirement.source_span = source.source_span;
    }
    for (const criterion of sub.criteria) criterion.source_ref_ids = criterion.source_ref_ids.map((id: string) => mappings[id]?.id || id);
}
plan.source_unit_ids = refs.map(ref => ref.id);
plan.edition_assumption = '2027년 CPA 시험 목표는 사용자 지시로 확정되었다. 기본 사례는 2026년 1월 1일 개시 보고기간이며 KGA 260.8의 시행 범위에 해당한다. 2025년 11월 공식 전문의 260.16~17과 2026년 7월 전문의 같은 문단·의존 문맥을 대조했다. 후속본의 직접 인용은 총괄이 등록한 2026년 전문 171~172쪽으로 연결한다. 추가 원문 확인은 r02/source-evidence.json에 기록한다. 금융위원회 2027년 공고는 출제 분야 비중을 밝히며 특정 기준서 판본을 확정하지 않는다. 향후 미공표 개정 내용을 확인했다고 주장하지 않는다.';
plan.scope.timing = ['2026년 1월 1일 개시 보고기간의 재무제표감사와 해당 재무제표의 보고기간에 관한 독립성 정보'];
set.verification.notes = [
    '2027년 CPA 시험 대비 제작이다. 사례는 2026년 1월 1일 개시 보고기간이며 KGA 260.8의 시행 범위에 해당한다. 2025년 11월 공식 전문과 2026년 7월 공식 전문의 260.16~17 및 의존 문맥을 대조했다. 2027년 최종 시험 적용 판본 확정과 이 사례의 적용 판단을 구별한다.',
    '원초안 draft-05-260-001에서 release 후보 pilot-05-008로 이어진 기존 문항의 R02 후속본이다. 세트·물음·criterion ID와 7점·5점 답안 요구를 유지했다. 기존 배치 원본·과거 receipt는 수정하지 않았다.',
    '260.17 공식 문단의 인쇄된 (a), (i), (ii)를 보존했다. 원문에 인쇄되어 있지 않은 (b)를 추가하지 않았다.',
    '물음 2는 독립성 커뮤니케이션의 내용을 묻는다. 260.20의 서면 형태는 해석 문맥이며 별도 득점 요건으로 추가하지 않는다. 260.13도 16(c)의 재커뮤니케이션 예외를 설명하는 문맥이며 추가 점수가 없다.',
    '직접 인용은 총괄 등록 공식 파일 cpa_uploader/data/official/delegated-r02-kga260-2026.txt에 연결했다. 독립 PDF 추출·판본·의존 문맥은 r02/source-evidence.json에서 확인한다. 생성기 packet은 공용 catalog가 고정된 뒤 별도로 구성한다.',
    '과거 수동 의미검수와 실제 채점 51회 일치는 역사적 증거다. 이번 1차에서는 현재 코드로 과거 raw 판정을 재처리하고 작성자 QA를 보강했다. 최종 모델 의미검수·실제 채점은 아직 실행하지 않았으며 needs_human_review를 유지한다.',
];
fs.writeFileSync(candidatePath, JSON.stringify(candidate, null, 2) + '\n');
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(`${folder}/source-registration-map.json`, JSON.stringify({
    checked_at: new Date().toISOString(), source_ids_authority: '총괄 source-registration-initial.json',
    previous_learning_unit_ids: ['src-73fe85bf893193bbc1', 'src-b0ab9073ba65ae159e'],
    source_ref_lineage: mappings, plan_source_unit_ids: plan.source_unit_ids,
    catalog_fingerprint_at_binding: catalog.fingerprint,
    packet_status: 'not_created_pending_global_catalog_freeze',
}, null, 2) + '\n');
console.log(JSON.stringify(refs.map(ref => ({ id: ref.id, file: ref.file, source_span: ref.source_span })), null, 2));
