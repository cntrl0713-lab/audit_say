import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const own = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(own, name), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const desc = name => ({ file: path.relative(process.cwd(), path.join(own, name)).replaceAll('\\', '/'), sha256: hash(path.join(own, name)) });
const data = read('catalog-data.json'), coverage = read('coverage.json');
const html = fs.readFileSync(path.join(own, 'review.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const decode = value => value.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([a-z-]+)="([^"]*)"/g)].map(match => [match[1], decode(match[2])]));
const tags = [...html.matchAll(/<article class="unit"[^>]*>/g)].map(match => attrs(match[0]));
const controls = Object.fromEntries(['query', 'topic', 'style', 'origin', 'reset', 'open-answers', 'close-answers', 'print', 'count', 'empty'].map(id => [id, {
  value: '', hidden: false, textContent: '', listeners: {}, addEventListener(event, callback) { this.listeners[event] = callback; },
}]));
const cards = tags.map(tag => ({ id: tag.id, hidden: false,
  dataset: Object.fromEntries(Object.entries(tag).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5), value])),
  answers: Array.from({ length: Number(tag['data-qcount']) }, () => ({ open: false })),
  querySelectorAll(selector) { assert.equal(selector, 'details.answer'); return this.answers; },
}));
let printCalls = 0;
const document = { querySelectorAll(selector) { assert.equal(selector, '.unit'); return cards; },
  getElementById(id) { return controls[id] ?? cards.find(card => card.id === id); }, addEventListener() {} };
const context = vm.createContext({ document, location: { hash: '' }, window: { addEventListener() {}, print() { printCalls++; } }, decodeURIComponent });
vm.runInContext(script, context, { timeout: 1000 });
function filter({ query = '', topic = '', style = '', origin = '' } = {}) {
  Object.assign(controls.query, { value: query }); Object.assign(controls.topic, { value: topic });
  Object.assign(controls.style, { value: style }); Object.assign(controls.origin, { value: origin });
  controls.query.listeners.input();
  return cards.filter(card => !card.hidden);
}
const all = filter(); assert.equal(all.length, 249);
assert.equal(controls.count.textContent, '249 학습 단위 · 280 물음 · 1113점');
assert.equal(filter({ style: 'case' }).length, 40); assert.equal(filter({ style: 'standard' }).length, 209);
const topicResults = data.topics.map(topic => {
  const actual = filter({ topic: topic.id }).map(card => card.id);
  const expected = data.units.filter(unit => unit.topics.some(t => t.id === topic.id)).map(unit => unit.id);
  assert.deepEqual(actual, expected);
  return { topic_id: topic.id, visible_units: actual.length, visible_questions: cards.filter(c => !c.hidden).reduce((n, c) => n + Number(c.dataset.qcount), 0) };
});
for (const unit of data.units) {
  const visible = filter({ query: unit.id });
  assert(visible.some(card => card.id === unit.id));
  const card = visible.find(item => item.id === unit.id);
  assert.equal(Number(card.dataset.qcount), unit.questions.length);
  // Search never rebuilds or removes the questions inside a selected case card.
  assert.equal(card.answers.length, unit.questions.length);
}
const multiword = filter({ query: 'pilot-02-004 crit5' });
assert(multiword.some(card => card.id === 'pilot-02-004--sub2--standard'));
assert(!multiword.some(card => card.id === 'pilot-02-004--sub1--standard'));
assert(filter({ query: 'src-point-a-200-a49' }).some(card => card.id === 'pilot-02-004--sub2--standard'));
assert.equal(filter({ query: '<script>nonexistent-injected-fixture</script>' }).length, 0);
assert.equal(controls.empty.hidden, false);
controls.reset.listeners.click(); assert.equal(cards.filter(c => !c.hidden).length, 249);
filter({ style: 'case' }); controls['open-answers'].listeners.click();
assert(cards.filter(c => !c.hidden).every(c => c.answers.every(a => a.open)));
assert(cards.filter(c => c.hidden).every(c => c.answers.every(a => !a.open)));
controls['close-answers'].listeners.click(); assert(cards.every(c => c.answers.every(a => !a.open)));
controls.print.listeners.click(); assert.equal(printCalls, 1);
const allIds = [...html.matchAll(/\bid="([^"]*)"/g)].map(match => decode(match[1]));
assert.equal(new Set(allIds).size, allIds.length);
let localLinks = 0, fragmentLinks = 0;
for (const match of html.matchAll(/<a href="([^"]*)"/g)) {
  const href = decode(match[1]);
  if (href.startsWith('#')) { assert(allIds.includes(decodeURIComponent(href.slice(1))), href); fragmentLinks++; }
  else { assert(!/^\w+:/u.test(href), href); assert(fs.existsSync(path.resolve(own, decodeURIComponent(href))), href); localLinks++; }
}
for (const input of coverage.inputs) assert.equal(hash(input.file), input.sha256);
const result = { version: 1, status: 'local_script_and_html_contract_check', actual_browser_render_test: false,
  method: 'Node vm executes the exact generated filter script against a DOM test double built from actual HTML attributes. This checks filter scope/counters/events, not browser layout.',
  browser_observation: 'CUA in-app browser was unavailable; Chrome rejected local file URL by browser URL policy. No workaround, local server, raw browser command or policy bypass was attempted.',
  html: desc('review.html'), coverage: desc('coverage.json'), script_sha256: sha(script),
  tests: { initial_counts: true, style_filter_counts: true, topic_filter_cases_preserved: true,
    topic_combinations_checked: topicResults.length, unit_id_queries_checked: data.units.length,
    multiword_search: true, source_id_search: true, unmatched_query: true, reset: true,
    visible_answer_expand_only: true, collapse: true, print_event: true,
    duplicate_html_ids: 0, local_file_links_verified: localLinks, internal_fragment_links_verified: fragmentLinks,
    inputs_unchanged: true }, topic_results: topicResults,
  api_calls: 0, database_writes: 0, content_approval: false, errors: [] };
fs.writeFileSync(path.join(own, 'interaction-check.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
const handoff = { version: 1, status: 'ready_for_local_human_content_review_not_accepted', counts: data.counts,
  artifacts: ['review.html', 'README.md', 'catalog-data.json', 'coverage.json', 'interaction-check.json', 'build.mjs', 'check-interactions.mjs'].map(desc),
  limitations: ['실제 브라우저 시각 검사는 로컬 URL 정책으로 수행하지 못했다. 원문 텍스트 및 HTML/검색 코드의 로컬 검사는 완료했다.', '실제 전수 모델 검증은 별도로 진행 중이며 이 생성물은 사람 검수나 게시 완료 기록이 아니다.'],
  writes_confined_to: path.relative(process.cwd(), own).replaceAll('\\', '/'), api_calls: 0, deployment: false, human_approval_records: 0, errors: [] };
fs.writeFileSync(path.join(own, 'handoff.json'), `${JSON.stringify(handoff, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ handoff: desc('handoff.json'), interaction: desc('interaction-check.json'), tests: result.tests, errors: [] }));
