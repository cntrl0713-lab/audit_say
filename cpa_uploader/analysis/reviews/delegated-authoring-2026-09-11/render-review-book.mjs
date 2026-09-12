import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { studyTopics } from '../../../wiki/scripts/ox-study-order.mjs';

const [manifestFile, label] = process.argv.slice(2);
if (!manifestFile || !label || !/^[a-z0-9-]+$/.test(label)) throw Error('최종 수집 manifest와 새 출력 이름 필요');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (manifest.collected_sets !== 49 || manifest.collected_questions !== 131 || manifest.errors.length) throw Error('49세트·131물음 수집과 정적 검사 완료 후 렌더링하십시오.');
const output = `docs/reports/question-authoring-by-topic-2026-09-11/${label}`;
if (fs.existsSync(output)) throw Error('기존 문제지 출력을 덮어쓰지 않습니다.');
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const records = manifest.entries.map(entry => {
  if (sha(entry.file) !== entry.sha256) throw Error(`${entry.plan_id}: 수집 이후 문항 변경`);
  const raw = JSON.parse(fs.readFileSync(entry.file, 'utf8'));
  return { entry, set: Array.isArray(raw) ? raw[0] : raw };
});
fs.mkdirSync(output, { recursive: true });
const link = (from, file) => path.relative(from, file).replaceAll('\\', '/');
const tableText = value => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
const summary = [];
for (const topic of studyTopics) {
  const group = records.filter(({set}) => set.classification.topic_id === topic.id);
  if (!group.length) continue;
  const filename = `topic-${topic.id}.md`;
  const lines = [`# 주제 ${topic.id} 검토용 문제·모범답안`, '',
    '2027년 CPA 시험 대비 초안이다. 사례 보고기간과 공식 판본은 각 계획을 따른다. 문항은 사람 검수 대기 상태이며, 이 문서의 생성은 실제 모델 검증·정본 편입·게시 완료를 뜻하지 않는다.', ''];
  for (const {entry,set} of group) {
    lines.push(`## ${entry.plan_id} · ${set.title}`, '',
      `실제 ID: \`${set.id}\` · ${entry.actual_questions}물음 · ${entry.points}점 · 담당 ${entry.package}`, '',
      `[문항 JSON](${link(output,entry.file)}) · [출제 계획](${link(output,entry.plan_files[0].file)}) · [작성자 QA](${link(output,entry.qa_file)})`, '',
      `문항 파일 SHA-256: \`${entry.sha256}\``, '', '### 사례', '', ...set.shared_context.facts.map(fact => `${fact.text}\n`));
    for (const [index,sub] of set.subquestions.entries()) {
      const points = sub.criteria.reduce((sum,criterion) => sum + criterion.max_points,0);
      lines.push(`### ${entry.plan_id}-Q${index+1} · ${sub.id} · ${points}점`, '', sub.prompt, '', '**모범답안**', '',
        ...sub.model_answer.map(answer => `- ${answer}`), '', '**채점요건**', '', '| criterion | 명제 | 점수 |', '|---|---|---:|',
        ...sub.criteria.map(criterion => `| ${tableText(criterion.id)} | ${tableText(criterion.claim)} | ${criterion.max_points} |`), '');
    }
    lines.push('### 직접 출처', '', ...set.source_refs.map(source =>
      `- \`${source.id}\` · [${source.title}](${link(output,source.file)}) · ${source.page || '본문 위치는 계획 참조'}`), '');
  }
  fs.writeFileSync(path.join(output,filename),lines.join('\n')+'\n',{flag:'wx'});
  summary.push(`| [주제 ${topic.id}](${filename}) | ${group.length} | ${group.reduce((n,r)=>n+r.entry.actual_questions,0)} | ${group.reduce((n,r)=>n+r.entry.points,0)} |`);
}
fs.writeFileSync(path.join(output,'README.md'),[
  '# 49세트·131물음 검토용 문제지', '',
  `현재 수집본 ${manifest.collected_sets}세트·${manifest.collected_questions}물음·${manifest.collected_points}점. OX 학습 순서로 표시하며 기존 ID는 유지한다.`, '',
  '2027년 CPA 시험 대비, 현재 확보한 공식 근거와 사례 보고기간을 기준으로 작성했다. 사람 검수 대기 초안의 읽기용 출력이다. 실제 의미검수·채점 결과와 잔여 실패는 총괄 실행 장부에서 별도로 확인한다.', '',
  `[수집·해시 장부](${link(output,manifestFile)}) · [총괄 실행 장부](${link(output,'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/README.md')})`, '',
  '| 주제 | 세트 | 물음 | 점수 |', '|---|---:|---:|---:|', ...summary, ''
].join('\n'),{flag:'wx'});
console.log(JSON.stringify({output,topics:summary.length,sets:records.length}));
