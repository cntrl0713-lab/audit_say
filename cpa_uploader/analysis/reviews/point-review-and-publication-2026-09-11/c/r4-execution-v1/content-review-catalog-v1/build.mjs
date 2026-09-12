import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const load = file => import(pathToFileURL(path.resolve(file)));
const { compileLearningCatalog } = await load('scripts/build-learning-unit-catalog.ts');
const { reviewedContentHash } = await load('cpa_uploader/questionBankPublication.ts');
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const own = `${D}/c/r4-execution-v1/content-review-catalog-v1`;
const inputSnapshots = new Map();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => { const bytes = fs.readFileSync(file); inputSnapshots.set(file, sha(bytes)); return JSON.parse(bytes); };
const desc = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const write = (name, value) => {
  const file = `${own}/${name}`;
  assert(['catalog-data.json', 'review.html', 'README.md', 'coverage.json'].includes(name));
  if (process.argv.includes('--refresh-unfinalized')) assert(!fs.existsSync(`${own}/handoff.json`), 'Finalized artifacts must be preserved.');
  fs.writeFileSync(file, value, { flag: process.argv.includes('--refresh-unfinalized') ? 'w' : 'wx' });
  return desc(file);
};
const jsonWrite = (name, value) => write(name, `${JSON.stringify(value, null, 2)}\n`);
const esc = text => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const unesc = text => text.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const localHref = file => path.relative(own, file).replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/');
const link = (file, text) => { assert(fs.existsSync(file), file); return `<a href="${esc(localHref(file))}">${esc(text)}</a>`; };
const sum = q => q.criteria.reduce((total, criterion) => total + criterion.max_points, 0);
const manifestFile = `${D}/a/execution-all-v9/manifest.json`;
const manifest = read(manifestFile), bank = read(manifest.bank_file);
assert.equal(sha(fs.readFileSync(manifest.bank_file)), manifest.bank_sha256);
const classificationFile = manifest.classification_contract.catalog.file;
const classification = read(classificationFile), review = read(manifest.classification_contract.review.file);
assert.equal(desc(classificationFile).sha256, manifest.classification_contract.catalog.sha256);
assert.equal(desc(manifest.classification_contract.review.file).sha256, manifest.classification_contract.review.sha256);
assert.equal(classification.source_file_sha256, manifest.bank_sha256);
const { classifications, units: allUnits } = compileLearningCatalog(bank, review.entries, classification.topics);
assert.deepEqual(classifications, classification.classifications);
const originalFile = `${D}/canonical-before.json`, original = read(originalFile);
const lineageFile = `${D}/root/lineage.json`, lineage = read(lineageFile).entries;
const selectedIds = new Set(manifest.jobs.map(job => job.set_id));
assert.equal(selectedIds.size, manifest.jobs.length);
const selected = bank.filter(set => selectedIds.has(set.id));
assert.equal(selected.length, manifest.jobs.length);
for (const job of manifest.jobs) {
  const value = read(job.file), set = Array.isArray(value) ? value[0] : value;
  assert.equal(desc(job.file).sha256, job.sha256);
  assert.deepEqual(set, selected.find(item => item.id === job.set_id));
}
const bySet = new Map(selected.map(set => [set.id, set]));
const byOld = new Map(original.map(set => [set.id, set]));
const byClass = new Map(classifications.map(row => [`${row.source_set_id}/${row.subquestion_id}`, row]));
const byReview = new Map(review.entries.map(row => [`${row.set_id}/${row.subquestion_id}`, row]));
const units = allUnits.filter(unit => selectedIds.has(unit.source_set_id));
function comparison(set, question) {
  const oldSet = byOld.get(set.id);
  if (!oldSet) return { kind: 'new', label: `신규 초안 · ${sum(question)}점 (기존 정본 물음 없음)`, old_points: null, current_points: sum(question), delta: null, original_subquestion_id: null };
  const split = lineage.find(row => row.set_id === set.id && row.parts.some(part => part.subquestion_id === question.id));
  if (split) {
    const oldQuestion = oldSet.subquestions.find(q => q.id === split.source_subquestion_id);
    assert(oldQuestion);
    const siblingIds = split.parts.map(part => part.subquestion_id);
    const newGroupPoints = set.subquestions.filter(q => siblingIds.includes(q.id)).reduce((n, q) => n + sum(q), 0);
    return { kind: 'split', label: `기존 ${split.source_subquestion_id} 묶음 ${sum(oldQuestion)}점 → 분리 묶음 ${newGroupPoints}점 / 현재 ${question.id} ${sum(question)}점`, old_points: null, current_points: sum(question), delta: null,
      original_subquestion_id: oldQuestion.id, group_old_points: sum(oldQuestion), group_current_points: newGroupPoints,
      group_delta: newGroupPoints - sum(oldQuestion), sibling_ids: siblingIds, reason: split.reason,
      note: '분리된 각 물음에 원래 묶음의 점수를 중복 배분하거나 개별 증감으로 계산하지 않는다.', original_question: oldQuestion };
  }
  const oldQuestion = oldSet.subquestions.find(q => q.id === question.id);
  assert(oldQuestion, `Unmapped original question ${set.id}/${question.id}`);
  const delta = sum(question) - sum(oldQuestion);
  return { kind: 'existing', label: `기존 ${sum(oldQuestion)}점 → 현재 ${sum(question)}점 (${delta > 0 ? '+' : ''}${delta})`, old_points: sum(oldQuestion), current_points: sum(question), delta,
    original_subquestion_id: oldQuestion.id, original_question: oldQuestion };
}
const dataUnits = units.map(unit => {
  const set = bySet.get(unit.source_set_id), job = manifest.jobs.find(j => j.set_id === set.id);
  const originalSet = byOld.get(set.id);
  const questions = unit.subquestions.map(display => {
    const key = `${set.id}/${display.id}`, question = set.subquestions.find(q => q.id === display.id);
    const metadata = byClass.get(key), reason = byReview.get(key);
    assert(question && metadata && reason);
    assert.equal(display.prompt, metadata.question_style === 'standard' ? metadata.standalone_prompt : question.prompt);
    assert.equal(display.max_points, sum(question));
    const sourceIds = [...new Set([...question.requirements.map(r => r.source_ref_id), ...question.criteria.flatMap(c => c.source_ref_ids)])];
    for (const sourceId of sourceIds) assert(set.source_refs.some(source => source.id === sourceId));
    return { key, original: question, display_prompt: display.prompt, metadata, classification_reason: reason.reason, comparison: comparison(set, question), source_ids: sourceIds, question_sha256: sha(JSON.stringify(question)) };
  });
  const item = { id: unit.id, source_set_id: set.id, title: set.title, style: unit.question_style,
    topics: unit.topics, points: unit.max_points, origin: originalSet ? 'existing' : 'new',
    facts: unit.shared_context.facts, questions, sources: set.source_refs,
    source_question_file: job.file, source_question_file_sha256: job.sha256, reviewed_content_hash: reviewedContentHash(set),
    serialized_set_sha256: sha(JSON.stringify(set)), source_set_points: set.subquestions.reduce((n, q) => n + sum(q), 0),
    original_set_points: originalSet ? originalSet.subquestions.reduce((n, q) => n + sum(q), 0) : null,
    original_set_sha256: originalSet ? sha(JSON.stringify(originalSet)) : null,
    plan_file: job.plan_file, plan_sha256: job.plan_sha256 };
  if (item.style === 'standard') { assert.equal(item.questions.length, 1); assert.deepEqual(item.facts, []); }
  else {
    assert(item.facts.length > 0);
    assert.deepEqual(item.facts, set.shared_context.facts);
    assert.deepEqual(item.questions.map(q => q.original.id), set.subquestions.filter(q => byClass.get(`${set.id}/${q.id}`).question_style === 'case').map(q => q.id));
  }
  assert.equal(item.points, item.questions.reduce((n, q) => n + sum(q.original), 0));
  return item;
});
const expectedKeys = selected.flatMap(set => set.subquestions.map(q => `${set.id}/${q.id}`)).sort();
const actualKeys = dataUnits.flatMap(unit => unit.questions.map(q => q.key)).sort();
assert.deepEqual(actualKeys, expectedKeys); assert.equal(new Set(actualKeys).size, actualKeys.length);
const counts = { selected_sets: selected.length, selected_questions: actualKeys.length, learning_units: dataUnits.length,
  standard_units: dataUnits.filter(u => u.style === 'standard').length, case_units: dataUnits.filter(u => u.style === 'case').length,
  case_questions: dataUnits.filter(u => u.style === 'case').reduce((n, u) => n + u.questions.length, 0),
  criteria: selected.reduce((n, s) => n + s.subquestions.reduce((a, q) => a + q.criteria.length, 0), 0),
  points: dataUnits.reduce((n, u) => n + u.points, 0), existing_sets: selected.filter(s => byOld.has(s.id)).length, new_sets: selected.filter(s => !byOld.has(s.id)).length };
assert.deepEqual([counts.selected_sets, counts.selected_questions, counts.learning_units], [119, 280, 249]);
const payload = { version: 1, purpose: 'human_content_review_local_catalog', status: 'human_review_not_recorded_actual_validation_in_progress',
  inputs: { manifest: desc(manifestFile), bank: desc(manifest.bank_file), classification: desc(classificationFile), classification_review: desc(manifest.classification_contract.review.file), original_bank: desc(originalFile), split_lineage: desc(lineageFile) },
  counts, topics: classification.topics, units: dataUnits };
const dataFile = jsonWrite('catalog-data.json', payload);

// Every source field is rendered as text, never HTML or Markdown supplied by content.
const renderedFields = new Map();
function field(key, text, className = 'text') {
  assert(!renderedFields.has(key), `Rendered field duplicated: ${key}`);
  renderedFields.set(key, String(text));
  return `<div class="${esc(className)}" data-field="${esc(key)}">${esc(text)}</div>`;
}
function sourceHtml(unit, source) {
  const id = `${unit.id}--src--${source.id}`;
  return `<details class="source" id="${esc(id)}"><summary><code>${esc(source.id)}</code> · ${esc(source.title ?? source.file)}</summary>
    <div class="small">${link(source.file, source.file)} · ${esc(source.page ?? '')} · ${esc(source.role)}<br>인용 SHA-256 <code>${esc(source.content_hash)}</code></div>
    ${source.source_span ? field(`${id}/span`, source.source_span) : ''}
    ${field(`${id}/quote`, source.source_quote, 'text quote')}</details>`;
}
function questionHtml(unit, item) {
  const q = item.original, prefix = `${unit.id}/${q.id}`;
  const old = item.comparison;
  const sourceLinks = ids => ids.map(id => `<a href="#${esc(`${unit.id}--src--${id}`)}"><code>${esc(id)}</code></a>`).join(' · ');
  return `<section class="question" data-question-key="${esc(item.key)}" id="${esc(`question-${item.key}`)}">
    <div class="qhead"><h3>${esc(q.id)} <span>${esc({ enumeration: '열거', descriptive: '서술', judgment: '판단·근거' }[q.type] ?? q.type)}</span></h3><strong>${sum(q)}점</strong></div>
    ${field(`${prefix}/prompt`, item.display_prompt, 'text prompt')}
    <p class="small topics">${item.metadata.topic_ids.map(id => `${id} ${esc(classification.topics.find(t => t.id === id).title)}`).join(' · ')}</p>
    <p class="delta">${esc(old.label)}</p>
    <details class="answer"><summary>모범답안과 ${q.criteria.length}개 채점 기준</summary>
      <h4>모범답안</h4>${q.model_answer.map((answer, index) => field(`${prefix}/answer/${index}`, answer, 'text model')).join('')}
      <h4>기준별 독립 배점</h4><div class="table-scroll"><table><thead><tr><th>기준</th><th>득점 명제 · 충족 조건</th><th>점수 계약</th><th>근거</th></tr></thead><tbody>
      ${q.criteria.map(c => `<tr data-criterion-key="${esc(`${item.key}/${c.id}`)}"><td><code>${esc(c.id)}</code></td><td>${field(`${prefix}/criterion/${c.id}/claim`, c.claim)}
        ${c.critical_facts.map(f => `<div class="fact-scope"><code>${esc(f.id)} / ${esc(f.type)}</code>${field(`${prefix}/criterion/${c.id}/fact/${f.id}`, f.expected)}</div>`).join('')}
        </td><td><strong>${c.max_points}점</strong><div class="small">${Object.entries(c.scores).map(([key, value]) => `${esc(key)} ${esc(value)}`).join('<br>')}</div></td>
        <td><code>${esc(c.requirement_id)}</code><br>${sourceLinks(c.source_ref_ids)}</td></tr>`).join('')}</tbody></table></div>
    </details>
    <details class="support"><summary>요구사항의 직접 인용 (${q.requirements.length})</summary>
      ${q.requirements.map(req => `<div class="requirement"><strong>${esc(req.id)}</strong> · ${sourceLinks([req.source_ref_id])}${req.source_span ? field(`${prefix}/requirement/${req.id}/span`, req.source_span) : ''}${field(`${prefix}/requirement/${req.id}/quote`, req.source_quote, 'text quote')}</div>`).join('')}
    </details>
    <details class="comparison"><summary>기존 정본 대비 · 분류 근거 · 내용 해시</summary>
      <p>${esc(old.label)}</p>${old.reason ? `<p>${esc(old.reason)}</p><p>${esc(old.note)}</p>` : ''}
      ${old.original_question ? `<p class="small">비교 원본 ${esc(unit.source_set_id)}/${esc(old.original_subquestion_id)} · ${link(originalFile, '검토 전 정본 스냅샷')}</p><h4>원발문</h4>${field(`${prefix}/old-prompt`, old.original_question.prompt)}<h4>원 채점 기준 (${sum(old.original_question)}점)</h4>${old.original_question.criteria.map(c => `<p><code>${esc(c.id)}</code> · ${c.max_points}점 · ${esc(c.claim)}</p>`).join('')}` : '<p>기존 정본에 없는 신규 초안이다. 과거 제작·실측 이력을 신규 수락 또는 게시로 표시하지 않는다.</p>'}
      ${item.display_prompt !== q.prompt ? `<h4>저장 원발문 (독립 발문과 다름)</h4>${field(`${prefix}/stored-prompt`, q.prompt)}` : ''}
      <h4>현재 분류 근거</h4>${field(`${prefix}/classification-reason`, item.classification_reason)}
      <p class="small">사례 참조 fact ID: ${esc(item.metadata.case_fact_ids.join(', ') || '없음')}<br>물음 JSON SHA-256 <code>${esc(item.question_sha256)}</code><br>분류 내용 hash <code>${esc(item.metadata.content_hash)}</code></p>
    </details>
  </section>`;
}
function unitHtml(unit) {
  const topTopics = unit.topics.map(t => `${t.id} ${t.title}`).join(' · ');
  const search = [unit.id, unit.source_set_id, unit.title, topTopics, ...unit.facts.map(f => f.text),
    ...unit.sources.flatMap(source => [source.id, source.title, source.page]),
    ...unit.questions.flatMap(q => [q.key, q.display_prompt, ...q.original.model_answer,
      ...q.original.requirements.map(r => r.id), ...q.original.criteria.flatMap(c => [c.id, c.claim])])].join(' ').toLocaleLowerCase('ko');
  return `<article class="unit" id="${esc(unit.id)}" data-style="${unit.style}" data-origin="${unit.origin}" data-topics="${esc(unit.topics.map(t => t.id).join(' '))}" data-search="${esc(search)}" data-qcount="${unit.questions.length}" data-points="${unit.points}">
    <header class="unit-head"><div class="badges"><span class="badge ${unit.style}">${unit.style === 'case' ? '사례형' : '기준서형 · 독립 물음'}</span><span class="badge">${unit.origin === 'new' ? '신규 초안' : '기존 정본 보완'}</span><span>${unit.questions.length}물음 · ${unit.points}점</span></div>
    <h2>${esc(unit.title)}</h2><div class="small"><code>${esc(unit.id)}</code><br>${esc(topTopics)}</div></header>
    ${unit.style === 'case' ? `<section class="context"><h3>공통 사실관계</h3>${unit.facts.map(f => `<div class="context-fact"><code>${esc(f.id)}</code>${field(`${unit.id}/fact/${f.id}`, f.text)}</div>`).join('')}<p class="small">검색한 주제와 관계없이 이 사례의 모든 사례형 물음을 함께 표시한다.</p></section>` : ''}
    ${unit.questions.map(item => questionHtml(unit, item)).join('')}
    <details class="all-sources"><summary>원 세트 출처 참조 전체 (${unit.sources.length})</summary>${unit.sources.map(source => sourceHtml(unit, source)).join('')}</details>
    <footer class="unit-footer"><details><summary>원문 파일·세트 해시·배점 계보</summary><p>${link(unit.source_question_file, unit.source_question_file)}<br>${link(unit.plan_file, '선택된 출제 계획')}</p>
    <p>원 세트 ${esc(unit.source_set_id)} 전체: ${unit.original_set_points === null ? '신규' : `${unit.original_set_points}점 →`} ${unit.source_set_points}점. 이 학습 단위는 ${unit.points}점이다.</p>
    <div class="small">원문 파일 SHA-256 <code>${unit.source_question_file_sha256}</code><br>검수 내용 hash <code>${unit.reviewed_content_hash}</code><br>세트 JSON SHA-256 <code>${unit.serialized_set_sha256}</code></div></details></footer>
  </article>`;
}
const unitBlocks = dataUnits.map(unitHtml);
const filterScript = `
const cards=[...document.querySelectorAll('.unit')];
const query=document.getElementById('query'),topic=document.getElementById('topic'),style=document.getElementById('style'),origin=document.getElementById('origin');
function matches(row,filters){return(!filters.style||row.style===filters.style)&&(!filters.origin||row.origin===filters.origin)&&(!filters.topic||row.topics.split(' ').includes(filters.topic))&&filters.words.every(word=>row.search.includes(word));}
function update(){const filters={style:style.value,topic:topic.value,origin:origin.value,words:query.value.toLocaleLowerCase('ko').trim().split(/\\s+/).filter(Boolean)};let n=0,q=0,p=0;for(const card of cards){card.hidden=!matches(card.dataset,filters);if(!card.hidden){n++;q+=Number(card.dataset.qcount);p+=Number(card.dataset.points);}}document.getElementById('count').textContent=n+' 학습 단위 · '+q+' 물음 · '+p+'점';document.getElementById('empty').hidden=n!==0;}
for(const control of [query,topic,style,origin])control.addEventListener('input',update);
document.getElementById('reset').addEventListener('click',()=>{query.value=topic.value=style.value=origin.value='';update();});
document.getElementById('open-answers').addEventListener('click',()=>cards.filter(c=>!c.hidden).forEach(c=>c.querySelectorAll('details.answer').forEach(d=>d.open=true)));
document.getElementById('close-answers').addEventListener('click',()=>cards.forEach(c=>c.querySelectorAll('details.answer').forEach(d=>d.open=false)));
document.getElementById('print').addEventListener('click',()=>window.print());
document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#"]');if(!a)return;const target=document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));if(!target)return;for(let node=target;node;node=node.parentElement){if(node.tagName==='DETAILS')node.open=true;} });
function showHash(){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(!target)return;const card=target.closest('.unit');if(card&&card.hidden){query.value=topic.value=style.value=origin.value='';update();}target.scrollIntoView();}window.addEventListener('hashchange',showHash);update();if(location.hash)showHash();`;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none'"><title>회계감사 문항 내용 검토 · 119세트</title><style>
:root{color-scheme:light;--ink:#172d3b;--muted:#5a6973;--line:#d8dfdf;--paper:#fbfaf6;--teal:#146b64}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.7 system-ui,"Malgun Gothic",sans-serif}a{color:#125f8b;text-underline-offset:3px}button,select,input{font:inherit}button,select{cursor:pointer}code{font:12px/1.5 ui-monospace,monospace;overflow-wrap:anywhere}h1,h2,h3,h4,p{margin:0 0 12px}h1{font-size:clamp(27px,4vw,40px);letter-spacing:-1.5px}h2{font-size:23px;line-height:1.45}h3{font-size:17px}h4{font-size:14px;margin-top:18px}.masthead{max-width:1120px;margin:auto;padding:44px 28px 24px}.eyebrow{font-size:12px;letter-spacing:2px;color:var(--teal);font-weight:750}.notice{border-left:4px solid #c28d30;background:#fff3d8;padding:15px 20px;margin:18px 0}.small{font-size:12px;color:var(--muted);overflow-wrap:anywhere}.stats{display:flex;gap:10px;flex-wrap:wrap}.stats span{background:#e9f1ec;padding:4px 12px;border-radius:20px}.toolbar{position:sticky;top:0;z-index:2;background:#f7f7f0f5;border-block:1px solid var(--line);padding:12px 24px;backdrop-filter:blur(8px)}.controls{max-width:1064px;margin:auto;display:flex;gap:10px;flex-wrap:wrap;align-items:end}.controls label{font-size:12px;display:flex;flex-direction:column;gap:3px}.controls input,.controls select,button{min-height:39px;border:1px solid #afbfbd;border-radius:7px;padding:6px 10px;background:white;color:var(--ink)}.search{flex:1;min-width:210px}.buttons{max-width:1064px;margin:9px auto 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.buttons button{min-height:32px;font-size:12px}#count{margin-left:auto;font-size:13px;font-weight:700}main{max-width:1120px;margin:auto;padding:28px}.unit{background:white;border:1px solid var(--line);border-radius:14px;margin-bottom:30px;overflow:hidden;scroll-margin-top:165px}.unit-head{padding:24px 28px;background:#edf3f1}.badges{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;margin-bottom:12px}.badge{border:1px solid #b9c8c5;border-radius:4px;padding:1px 7px}.badge.case{background:#284953;color:white;border-color:#284953}.badge.standard{background:#146b64;color:white;border-color:#146b64}.context{margin:24px 28px;padding:20px;background:#f3f6f8;border-radius:8px}.context-fact{display:grid;grid-template-columns:70px 1fr;gap:8px;margin:12px 0}.question{padding:26px 28px;border-top:1px solid var(--line);scroll-margin-top:165px}.qhead{display:flex;justify-content:space-between;gap:15px}.qhead h3 span{font-size:12px;font-weight:400;color:var(--muted);margin-left:8px}.qhead strong{white-space:nowrap;color:var(--teal)}.text{white-space:pre-wrap;overflow-wrap:anywhere}.prompt{font-size:18px;line-height:1.85;margin:8px 0 16px}.delta{font-size:13px;color:#805416;background:#fff7e9;padding:7px 12px;border-radius:5px;display:inline-block}details{margin-top:12px}summary{cursor:pointer;font-weight:650;font-size:14px;padding:9px 0}summary:hover{color:var(--teal)}details[open]>summary{margin-bottom:10px}.model{padding:12px 16px;background:#eff7f2;border-left:3px solid #76a68f;margin:7px 0}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid var(--line);padding:10px;vertical-align:top}th{text-align:left;background:#f1f4f4;font-size:12px}td:first-child{min-width:105px}td:nth-child(3){min-width:92px}.fact-scope{border-top:1px dashed #dce1de;margin-top:9px;padding-top:8px;font-size:12px;color:#475d62}.quote{background:#f7f7f4;padding:14px;border-radius:5px;font-size:13px;line-height:1.7;margin-top:8px}.requirement{margin:15px 0}.all-sources{padding:6px 28px 22px;border-top:1px solid var(--line)}.source{scroll-margin-top:165px}.unit-footer{border-top:1px solid var(--line);padding:10px 28px 22px;background:#fafbf9}.comparison{font-size:13px}.comparison p{margin-top:10px}[hidden]{display:none!important}#empty{text-align:center;padding:70px}.footer{max-width:1064px;margin:0 auto 45px;font-size:12px;color:var(--muted)}@media(max-width:650px){main{padding:14px}.masthead{padding:28px 18px}.unit-head,.question{padding:20px}.context{margin:20px;padding:15px}.context-fact{display:block}.toolbar{position:static;padding:12px}.all-sources,.unit-footer{padding-inline:20px}.unit{scroll-margin-top:12px}.controls select{max-width:270px}}@media print{body{background:white;font-size:11pt}.toolbar,.footer{display:none}.masthead{padding:0 0 15px}main{padding:0}.unit{border-radius:0;break-after:page}.unit:last-child{break-after:auto}.question,details,table{break-inside:auto}.unit-head{background:#edf3f1!important;print-color-adjust:exact}.prompt{font-size:12pt}.unit[hidden]{display:none!important}a{color:inherit;text-decoration:none}.all-sources{font-size:9pt}}
</style></head><body><header class="masthead"><div class="eyebrow">AUDIT SAY / CONTENT REVIEW</div><h1>회계감사 문항 내용 검토</h1><p>발문, 모범답안, 독립 배점과 직접 근거를 한곳에서 대조합니다.</p><div class="notice"><strong>사람 확인은 아직 기록되지 않았습니다. 실제 전수검증은 진행 중입니다.</strong><br>이 자료는 선택된 후보 내용을 보여 주는 로컬 검토본입니다. 정식 수락·정본 반영·게시 완료를 뜻하지 않습니다.</div><div class="stats"><span>${counts.selected_sets}세트</span><span>${counts.selected_questions}물음</span><span>${counts.learning_units}학습 단위</span><span>${counts.points}점</span><span>기존 ${counts.existing_sets} · 신규 ${counts.new_sets}</span></div><p class="small" style="margin-top:15px">후보 v8 · master execution-all-v9 선택 · 2026-09-12 생성<br>은행 SHA-256 <code>${manifest.bank_sha256}</code><br>기준서형 ${counts.standard_units}개는 독립 발문, 사례형 ${counts.case_units}개는 ${counts.case_questions}물음 전체와 공통 사실을 표시합니다. 출처 인용과 모범답안을 포함하므로 로컬 검토용으로 사용합니다.</p></header>
<div class="toolbar"><div class="controls"><label class="search">ID · 내용 검색<input id="query" type="search" placeholder="예: pilot-19, 계속기업, A49" autocomplete="off"></label><label>주제<select id="topic"><option value="">모든 주제 (OX 순서)</option>${classification.topics.map(t => `<option value="${t.id}">${t.id} ${esc(t.title)}</option>`).join('')}</select></label><label>학습 유형<select id="style"><option value="">모두</option><option value="standard">기준서형</option><option value="case">사례형</option></select></label><label>계보<select id="origin"><option value="">모두</option><option value="existing">기존 정본 보완</option><option value="new">신규 초안</option></select></label></div><div class="buttons"><button id="reset">검색 초기화</button><button id="open-answers">표시된 답안 펼치기</button><button id="close-answers">답안 접기</button><button id="print">현재 화면 인쇄</button><span id="count">${counts.learning_units} 학습 단위 · ${counts.selected_questions} 물음 · ${counts.points}점</span></div></div>
<main><p class="small">주제나 ID가 사례의 일부 물음에만 맞아도 사례 전체가 표시됩니다. 인쇄 전 필요한 답안·출처 항목을 펼치세요.</p><div id="empty" hidden>검색 조건에 맞는 학습 단위가 없습니다.</div>${unitBlocks.join('\n')}</main><footer class="footer">${link(manifestFile, '선택 매니페스트')} · ${link(manifest.bank_file, '후보 원문')} · ${link(classificationFile, '학습 분류')} · <a href="README.md">검토 색인</a> · <a href="coverage.json">정적 누락·중복 검사</a><br>검색·펼치기는 현재 화면만 바꿉니다. 저장·승인·API·배포 동작은 없습니다.</footer><script>${filterScript}</script></body></html>`;

// Verify the actual HTML, not just the source list: all field text round-trips exactly.
const extracted = new Map();
for (const match of html.matchAll(/<div class="[^"]*" data-field="([^"]*)">([\s\S]*?)<\/div>/g)) {
  const key = unesc(match[1]); assert(!extracted.has(key)); extracted.set(key, unesc(match[2]));
}
assert.deepEqual(extracted, renderedFields);
assert.equal([...html.matchAll(/data-question-key="/g)].length, counts.selected_questions);
assert.equal([...html.matchAll(/data-criterion-key="/g)].length, counts.criteria);
assert.equal([...html.matchAll(/<article class="unit"/g)].length, counts.learning_units);
assert.equal([...html.matchAll(/<script>/g)].length, 1);
assert.equal([...html.matchAll(/<\/script>/g)].length, 1);
for (const hostile of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '" onclick="x', '&lt;script&gt;']) {
  assert.equal(unesc(esc(hostile)), hostile); assert(!esc(hostile).includes('<'));
}
for (const unit of dataUnits) for (const topic of unit.topics) {
  const matched = unit.topics.some(t => t.id === topic.id);
  assert(matched);
  if (unit.style === 'case') assert.deepEqual(unit.questions.map(q => q.key), actualKeys.filter(key => key.startsWith(`${unit.source_set_id}/`) && byClass.get(key).question_style === 'case'));
}
const htmlFile = write('review.html', html);
const rows = dataUnits.map(unit => `| [${unit.id}](review.html#${encodeURIComponent(unit.id)}) | ${unit.style === 'case' ? '사례형' : '기준서형'} | ${unit.questions.map(q => q.original.id).join(', ')} | ${unit.topics.map(t => t.id).join(', ')} | ${unit.points} | ${unit.origin === 'new' ? '신규' : '기존'} |`);
const md = `# 문항 내용 검토 색인\n\n[로컬 검토 HTML 열기](review.html)\n\n사람 확인은 아직 기록되지 않았으며 실제 전수검증은 진행 중이다. 이 자료의 생성·정적 검사 통과는 의미검수 통과, 사람 승인, 정본 반영 또는 게시 완료가 아니다. API 호출·배포·승인 기록은 0이다.\n\n선택된 **119세트·280물음·249학습 단위·${counts.points}점**을 모두 담았다. 기준서형 209개는 부모 사실 없이 독립 발문으로 표시하고, 사례형 40개는 공통 사실과 71개 물음을 함께 표시한다. 주제·ID·내용 검색은 학습 단위 전체의 표시 여부만 바꾸며 사례 내부의 물음을 자르지 않는다.\n\nHTML에서 답안 펼치기, 기준별 점수·충족 조건, requirement 인용, 전체 source 참조, 기존 정본 대비 점수와 내용 해시를 확인할 수 있다. 인쇄는 현재 필터와 펼친 항목을 따른다. 저장·승인 기능 및 외부 연결 호출은 없다.\n\n기존 대비는 [검토 시작 정본 스냅샷](${localHref(originalFile)})을 기준으로 한다. 신규 49세트에는 기존 정본 점수를 만들지 않는다. 기존 70세트의 변경을 표시하며, 10-002/15-002/18-003 분리 물음은 원 묶음→분리 묶음의 총점을 별도로 표시하여 원점수를 여러 물음에 중복 배분하지 않는다.\n\n은행 SHA-256: \`${manifest.bank_sha256}\`\n\n- [선택 매니페스트](${localHref(manifestFile)})\n- [현재 분류 카탈로그](${localHref(classificationFile)})\n- [표시 데이터와 계보](catalog-data.json)\n- [누락·중복·본문·문자 이스케이프 검사](coverage.json)\n\n기존 저장 상태 필드를 검토 완료 배지로 사용하지 않는다. 이 자료는 해당 후보의 내용을 검토하기 위한 시점 자료이며 이후 새 은행이 확정되면 새 출력으로 생성해야 한다. 원본 JSON·원문·과거 19개 보고서·앱·DB는 변경하지 않았다.\n\n| 학습 단위 | 유형 | 물음 ID | 주제 | 점수 | 계보 |\n| --- | --- | --- | --- | ---: | --- |\n${rows.join('\n')}\n`;
const indexFile = write('README.md', md);
for (const [file, oldHash] of inputSnapshots) assert.equal(desc(file).sha256, oldHash);
const coverage = {
  version: 1, status: 'local_static_render_coverage_checked_not_content_approval', checked_at: new Date().toISOString(),
  counts, artifacts: { html: htmlFile, index: indexFile, data: dataFile }, inputs: [...inputSnapshots].map(([file, sha256]) => ({ file, sha256 })),
  checks: { full_classification_recompiled_equal: true, selected_job_files_equal_candidate: true,
    selected_question_key_exact_set_equal: true, duplicate_question_keys: 0, omitted_questions: 0, extra_questions: 0,
    html_question_sections: counts.selected_questions, html_criterion_rows: counts.criteria,
    exact_text_fields_roundtripped: renderedFields.size, standard_parent_facts: 0,
    case_parent_facts_exact: true, case_all_subquestions_exact: true, topic_filter_preserves_whole_cases: true,
    source_ids_resolved: true, required_source_quotes_rendered_exact: true, model_answers_rendered_exact: true,
    html_unsafe_text_escaped: true, hostile_fixture_roundtrips: 4, scripts_count: 1,
    input_file_hashes_unchanged_after_generation: true, external_scripts_styles_fonts_requests: 0 },
  hash_definitions: { bank_sha256: '입력 파일 바이트의 SHA-256이며 DB 봉인 해시와 구별한다.', question_sha256: 'SHA256(JSON.stringify(candidate subquestion))', serialized_set_sha256: 'SHA256(JSON.stringify(candidate set))', reviewed_content_hash: 'production reviewedContentHash(set)', classification_content_hash: '정식 학습 분류 컴파일 결과의 content_hash' },
  matrix: dataUnits.map(unit => ({ learning_unit_id: unit.id, set_id: unit.source_set_id, style: unit.style, topic_ids: unit.topics.map(t => t.id), fact_ids: unit.facts.map(f => f.id),
    questions: unit.questions.map(q => ({ subquestion_id: q.original.id, criterion_ids: q.original.criteria.map(c => c.id), points: sum(q.original), display_prompt_sha256: sha(q.display_prompt), original_question_sha256: q.question_sha256, comparison: Object.fromEntries(Object.entries(q.comparison).filter(([key]) => key !== 'original_question')) })) })),
  api_calls: 0, database_writes: 0, human_approval_records: 0, deployment: false, final_semantic_acceptance_claimed: false, errors: []
};
const coverageFile = jsonWrite('coverage.json', coverage);
console.log(JSON.stringify({ ...counts, html: htmlFile, index: indexFile, coverage: coverageFile, exact_text_fields: renderedFields.size, errors: [] }));
