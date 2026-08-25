import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const wikiDir = path.resolve(scriptDir, '..');
const repoDir = path.resolve(scriptDir, '../../..');
const allowedTags = new Set([
  'audit',
  'ethics',
  'planning',
  'risk',
  'control',
  'evidence',
  'procedures',
  'completion',
  'reporting',
  'group-audit',
  'icfr',
  'assurance',
  'question-generation',
  'source-map',
  'quality',
]);
const requiredFields = ['title', 'created', 'updated', 'type', 'status', 'review_required', 'tags', 'sources', 'confidence'];
const exemptFrontmatter = new Set(['SCHEMA.md', 'index.md', 'log.md']);

function allMarkdown(root) {
  const results = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'scripts') results.push(...allMarkdown(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return null;
  const fields = {};
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) fields[match[1]] = match[2].trim();
  }
  return fields;
}

function parseInlineArray(value) {
  if (!value?.startsWith('[') || !value.endsWith(']')) return [];
  return value.slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function wikiTarget(raw) {
  const target = raw.split('|')[0].split('#')[0].trim();
  return path.basename(target, '.md');
}

const files = allMarkdown(wikiDir).sort();
const pageByBasename = new Map();
const errors = [];
const warnings = [];
const inbound = new Map();

for (const file of files) {
  const basename = path.basename(file, '.md');
  if (pageByBasename.has(basename)) errors.push(`중복 basename: ${basename}`);
  pageByBasename.set(basename, file);
  inbound.set(basename, 0);
}

for (const file of files) {
  const relative = path.relative(wikiDir, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).length;
  const basename = path.basename(file);
  const frontmatter = parseFrontmatter(text);

  if (!exemptFrontmatter.has(basename)) {
    if (!frontmatter) {
      errors.push(`${relative}: frontmatter 없음`);
    } else {
      for (const field of requiredFields) {
        if (!(field in frontmatter)) errors.push(`${relative}: frontmatter ${field} 누락`);
      }
      for (const tag of parseInlineArray(frontmatter.tags)) {
        if (!allowedTags.has(tag)) errors.push(`${relative}: 허용되지 않은 tag ${tag}`);
      }
      for (const source of parseInlineArray(frontmatter.sources)) {
        const resolved = path.resolve(repoDir, source);
        if (!fs.existsSync(resolved)) errors.push(`${relative}: source 없음 ${source}`);
      }
    }
  }

  if (!['SCHEMA.md'].includes(basename) && !/^[a-z0-9][a-z0-9-]*\.md$/.test(basename)) {
    errors.push(`${relative}: 파일명 규칙 위반`);
  }

  const wikilinks = [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => wikiTarget(match[1]));
  if (!exemptFrontmatter.has(basename) && wikilinks.length < 2) {
    errors.push(`${relative}: outbound wikilink가 2개 미만`);
  }
  for (const target of wikilinks) {
    if (!pageByBasename.has(target)) {
      errors.push(`${relative}: 깨진 wikilink [[${target}]]`);
    } else {
      inbound.set(target, (inbound.get(target) || 0) + 1);
    }
  }

  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)) {
    const target = decodeURI(match[1]);
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) errors.push(`${relative}: source link 없음 ${target}`);
  }

  if (lines > 400) errors.push(`${relative}: ${lines}줄로 hard limit 400 초과`);
  else if (lines > 200) warnings.push(`${relative}: ${lines}줄, 분할 검토 권장`);
}

const indexText = fs.readFileSync(path.join(wikiDir, 'index.md'), 'utf8');
for (const file of files) {
  const basename = path.basename(file);
  if (exemptFrontmatter.has(basename)) continue;
  const slug = path.basename(file, '.md');
  if (!indexText.includes(`[[${slug}]]`)) errors.push(`index.md: [[${slug}]] 누락`);
}

for (const [slug, count] of inbound) {
  const basename = path.basename(pageByBasename.get(slug));
  if (!exemptFrontmatter.has(basename) && count === 0) errors.push(`orphan page: ${slug}`);
}

const result = {
  wikiDir,
  markdownFiles: files.length,
  contentPages: files.length - exemptFrontmatter.size,
  errors,
  warnings,
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
