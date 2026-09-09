import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildWiki } from './build-wiki.mjs';
import { allMarkdown, lintWiki, parseFrontmatter } from './lint-wiki.mjs';
import { topicDefinitions } from './topic-definitions.mjs';

const defaultRepoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// Independent of both the builder and source-catalog parsers: compare the original
// TOC rows with the actual concept navigation, including page lists and targets.
/** @param {{repoDir?: string, pages?: Map<string, string>}} options */
export function checkSourceNavigation({ repoDir = defaultRepoDir, pages } = {}) {
  const wikiDir = path.join(repoDir, 'cpa_uploader/wiki');
  const rawDir = path.join(repoDir, 'cpa_uploader/data/회계감사_통합학습자료');
  const toc = fs.readFileSync(path.join(rawDir, '00_통합_목차.md'), 'utf8');
  const expected = new Map(topicDefinitions.map(topic => [topic.id, []]));
  const errors = [];
  let topicId = null;
  let inTopics = false;
  for (const [index, rawLine] of toc.split(/\r\n?|\n/u).entries()) {
    const line = rawLine.trim();
    if (line.startsWith('### ')) topicId = line.slice(4).split('.')[0].trim();
    else if (line.startsWith('## ')) {
      topicId = null;
      inTopics = line === '## 공통 분류체계';
    }
    if (!inTopics) continue;
    const quotedFile = line.match(/^[-*]\s+`([^`]+\.md)`\s*:\s*(.+)$/u);
    if (!quotedFile) continue;
    if (!expected.has(topicId)) {
      errors.push(`원자료 탐색: 목차 ${index + 1}행의 주제 연결을 확인할 수 없음`);
      continue;
    }
    expected.get(topicId).push({ file: path.resolve(rawDir, quotedFile[1]), pages: quotedFile[2].trim() });
  }
  let expectedLinks = 0;
  let actualLinks = 0;
  for (const topic of topicDefinitions) {
    const relative = `concepts/${topic.slug}.md`;
    const target = path.join(wikiDir, relative);
    const wanted = expected.get(topic.id);
    expectedLinks += wanted.length;
    if (!wanted.length) errors.push(`${relative}: 목차의 원자료 항목이 비어 있음`);
    const content = pages ? pages.get(relative) : fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (content == null) {
      errors.push(`${relative}: 원자료 탐색 문서 없음`);
      continue;
    }
    let inNavigation = false;
    let sections = 0;
    const found = [];
    for (const rawLine of content.split(/\r\n?|\n/u)) {
      const line = rawLine.trim();
      if (line.startsWith('## ')) {
        inNavigation = line === '## 원자료 탐색';
        if (inNavigation) sections++;
        continue;
      }
      if (!inNavigation || !line) continue;
      const entry = line.match(/^- \[[^\]]+\]\(([^)]+)\):\s*(.+)$/u);
      if (!entry) {
        errors.push(`${relative}: 원자료 탐색 항목 형식 오류: ${line}`);
        continue;
      }
      try {
        const file = path.resolve(path.dirname(target), decodeURIComponent(entry[1]));
        if (!fs.existsSync(file)) errors.push(`${relative}: 원자료 파일 없음: ${entry[1]}`);
        found.push({ file, pages: entry[2].trim() });
      } catch {
        errors.push(`${relative}: 원자료 링크 해석 실패: ${entry[1]}`);
      }
    }
    actualLinks += found.length;
    if (sections !== 1 || !found.length) errors.push(`${relative}: 원자료 탐색 절은 하나이며 비어 있으면 안 됨`);
    const key = entry => JSON.stringify([entry.file, entry.pages]);
    const remaining = found.map(key);
    for (const entry of wanted) {
      const index = remaining.indexOf(key(entry));
      if (index < 0) errors.push(`${relative}: 목차 원자료 연결 누락·위치 불일치: ${path.relative(rawDir, entry.file)}: ${entry.pages}`);
      else remaining.splice(index, 1);
    }
    if (remaining.length) errors.push(`${relative}: 목차에 없는 원자료 연결 ${remaining.length}개`);
  }
  return { expectedLinks, actualLinks, topics: expected.size, errors };
}

export function normalizeGeneratedPage(text) {
  // Ignore build dates and line endings; dates inside source evidence remain significant.
  return text.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n')
    .replace(/^---\n[\s\S]*?\n---(?=\n|$)/u, frontmatter => frontmatter.replace(/^(created|updated): \d{4}-\d{2}-\d{2}$/gmu, '$1: <build-date>'))
    .replace(/^(> Last updated: )\d{4}-\d{2}-\d{2}(?= \|)/gmu, '$1<build-date>')
    .trimEnd();
}

export function checkWiki({ repoDir = defaultRepoDir } = {}) {
  const wikiDir = path.join(repoDir, 'cpa_uploader/wiki');
  const lint = lintWiki({ repoDir });
  const errors = [...lint.errors];
  let sourceNavigation;
  try {
    sourceNavigation = checkSourceNavigation({ repoDir });
    errors.push(...sourceNavigation.errors);
  } catch (error) {
    errors.push(`원자료 탐색 독립 검증 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
  const drift = [];
  let built;
  try { built = buildWiki({ repoDir }); }
  catch (error) {
    errors.push(`위키 생성 입력 검증 실패: ${error instanceof Error ? error.message : String(error)}`);
    return { ...lint, errors, drift, sourceNavigation, generatedPages: 0 };
  }
  for (const [relative, expected] of built.pages) {
    const file = path.resolve(wikiDir, relative);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (actual === null || normalizeGeneratedPage(actual) !== normalizeGeneratedPage(expected)) {
      const kind = actual === null ? 'missing' : 'changed';
      drift.push({ file: relative, kind });
      errors.push(`${relative}: ${kind === 'missing' ? '생성 문서 없음' : '정본·출처·생성 계약과 내용 불일치'}`);
    }
  }
  for (const file of allMarkdown(wikiDir)) {
    const relative = path.relative(wikiDir, file).split(path.sep).join('/');
    const generatedDirectory = /^(?:concepts|questions|_meta)\//u.test(relative);
    const generatedStatus = parseFrontmatter(fs.readFileSync(file, 'utf8'))?.status === 'generated';
    if ((generatedDirectory || generatedStatus) && !built.pages.has(relative)) {
      drift.push({ file: relative, kind: 'extra' });
      errors.push(`${relative}: 현재 생성 대상에 없는 오래된 생성 문서`);
    }
  }
  return { ...lint, errors, drift, sourceNavigation, generatedPages: built.pages.size, summary: built.summary };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.slice(2).some(argument => argument !== '--check')) {
    console.error('사용법: node cpa_uploader/wiki/scripts/check-wiki.mjs [--check]');
    process.exitCode = 1;
  } else {
    const result = checkWiki();
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) process.exitCode = 1;
  }
}
