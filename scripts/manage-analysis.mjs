import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQuestionElements, renderQuestionElements, checkQuestionElementOutputs } from '../cpa_uploader/questionElements.mjs';
import { buildCoverage, renderCoverage, coverageDirectory } from '../cpa_uploader/analysis/coverage/build-coverage.mjs';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('사용법: node scripts/manage-analysis.mjs [--check]');
const normalize = text => text.replaceAll('\r\n', '\n');
const dataset = buildQuestionElements({ repoDir });
const elementPages = renderQuestionElements(dataset, { repoDir });
const coverage = buildCoverage({ repoDir, dataset });
const coveragePages = renderCoverage(coverage);
const pages = new Map([...elementPages, ...coveragePages]);
const errors = check ? checkQuestionElementOutputs(elementPages, { repoDir }) : [];
for (const [relative, body] of pages) {
  const file = path.join(repoDir, relative);
  if (check) {
    if (coveragePages.has(relative) && (!fs.existsSync(file) || normalize(fs.readFileSync(file, 'utf8')) !== normalize(body))) errors.push(`${relative}: 현재 입력과 생성 결과 불일치`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
}
const topicDir = path.join(repoDir, coverageDirectory, 'topics');
if (check && fs.existsSync(topicDir)) for (const name of fs.readdirSync(topicDir)) {
  const relative = `${coverageDirectory}/topics/${name}`;
  if (name.endsWith('.md') && !pages.has(relative)) errors.push(`${relative}: 생성 대상에 없는 문서`);
}
console.log(JSON.stringify({ mode: check ? 'check' : 'build', files: pages.size, ...coverage.summary,
  relationship_review_pending: coverage.review_queue.length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
