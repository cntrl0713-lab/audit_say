// 기준서 요구사항 절 대비 v3 문제은행의 출제 공백을 스캔한다.
// 사용: node cpa_uploader/wiki/scripts/gap-scan.mjs [--sections]
//
// 판정은 근사치다. 은행의 인용은 data/official 발췌에서, 절 본문은 통합학습자료에서
// 오기 때문에 같은 요구사항이라도 표현이 다르면 포함률이 낮게 나온다.
// 결과는 검토 후보이며 원문 대조와 사람 검수를 대체하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export function scanGaps({ repoDir = path.resolve(scriptDir, '../../..') } = {}) {
const standardsDir = path.join(repoDir, 'cpa_uploader/data/회계감사_통합학습자료/01_감사기준');
const bankPath = path.join(repoDir, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');

// 포함률 임계값. 아래 두 값 사이는 '얇음'으로 본다.
const GAP_THRESHOLD = 15;
const COVERED_THRESHOLD = 35;

function readRequirementSections() {
  const sections = [];
  for (const file of fs.readdirSync(standardsDir).filter((name) => name.endsWith('.md'))) {
    const lines = fs.readFileSync(path.join(standardsDir, file), 'utf8').split(/\r?\n/);
    let standard = null;
    let group = null;
    let current = null;
    const flush = () => {
      if (current && current.body.trim()) sections.push(current);
      current = null;
    };
    for (const line of lines) {
      // 08_기준서_600_705_보완학습.md는 기준서 제목이 ##, 절이 ###로만 구성된다.
      const standardHeading = line.match(/^#{1,2} KGA (\d+):/);
      if (standardHeading) {
        flush();
        standard = `KGA ${standardHeading[1]}`;
        group = '요구사항';
        continue;
      }
      const groupHeading = line.match(/^## (.+)/);
      if (groupHeading) {
        flush();
        group = groupHeading[1].trim();
        continue;
      }
      const sectionHeading = line.match(/^### (.+)/);
      if (sectionHeading) {
        flush();
        current = { standard, group, name: sectionHeading[1].trim(), file, body: '' };
        continue;
      }
      if (current) current.body += `${line}\n`;
    }
    flush();
  }
  return sections.filter((section) => section.group === '요구사항');
}

const normalize = (text) => (text || '').replace(/[\s*`_#>\-–—·・()（）[\]0-9]/g, '');

function grams(text, size = 4) {
  const normalized = normalize(text);
  const result = new Set();
  for (let index = 0; index + size <= normalized.length; index += 1) {
    result.add(normalized.slice(index, index + size));
  }
  return result;
}

function readBankByStandard() {
  const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  const byStandard = new Map();
  for (const set of bank) {
    const parts = set.source_refs.map((source) => source.source_quote);
    for (const subquestion of set.subquestions) {
      parts.push(subquestion.prompt, ...(subquestion.model_answer || []));
      for (const criterion of subquestion.criteria) parts.push(criterion.claim);
    }
    const entry = { id: set.id, grams: grams(parts.join(' ')) };
    for (const standard of set.classification.standards || []) {
      if (!byStandard.has(standard)) byStandard.set(standard, []);
      byStandard.get(standard).push(entry);
    }
  }
  return byStandard;
}

const sections = readRequirementSections();
const byStandard = readBankByStandard();
const seen = new Set();
const rows = [];
for (const section of sections) {
  const key = `${section.standard}|${section.name}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const sectionGrams = grams(section.body);
  // 너무 짧은 절은 우연 일치로 점수가 튀므로 집계에서 제외한다.
  if (sectionGrams.size < 40) continue;
  let best = 0;
  let bestSet = '-';
  for (const entry of byStandard.get(section.standard) || []) {
    let hit = 0;
    for (const gram of sectionGrams) if (entry.grams.has(gram)) hit += 1;
    const score = hit / sectionGrams.size;
    if (score > best) {
      best = score;
      bestSet = entry.id;
    }
  }
  const score = Number((best * 100).toFixed(1));
  const tier = score < GAP_THRESHOLD ? '공백' : score < COVERED_THRESHOLD ? '얇음' : '커버';
  rows.push({ standard: section.standard, name: section.name, file: section.file, score, tier, bestSet });
}

rows.sort((left, right) => left.score - right.score);
const totals = { 공백: 0, 얇음: 0, 커버: 0 };
const perStandard = new Map();
for (const row of rows) {
  totals[row.tier] += 1;
  if (!perStandard.has(row.standard)) perStandard.set(row.standard, { 공백: 0, 얇음: 0, 커버: 0 });
  perStandard.get(row.standard)[row.tier] += 1;
}

return { rows, totals, perStandard };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const { rows, totals, perStandard } = scanGaps();
console.log(`요구사항 절 ${rows.length}개 · 공백 ${totals.공백} · 얇음 ${totals.얇음} · 커버 ${totals.커버}`);
console.log('');
console.log('기준서별 (공백+얇음 많은 순)');
const ranked = [...perStandard.entries()].sort((left, right) => (
  right[1].공백 + right[1].얇음 - (left[1].공백 + left[1].얇음)
));
for (const [standard, tiers] of ranked) {
  console.log(`  ${standard.padEnd(9)} 공백 ${tiers.공백} · 얇음 ${tiers.얇음} · 커버 ${tiers.커버}`);
}
console.log('');
console.log('공백 절');
for (const row of rows.filter((entry) => entry.tier === '공백')) {
  console.log(`  ${String(row.score).padStart(5)}%  ${row.standard}  ${row.name}`);
}
if (process.argv.includes('--sections')) {
  console.log('');
  console.log('전체 절');
  for (const row of rows) {
    console.log(`  ${String(row.score).padStart(5)}%  ${row.tier}  ${row.standard}  ${row.name}  (최근접: ${row.bestSet})`);
  }
}

}
