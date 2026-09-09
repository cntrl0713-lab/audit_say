import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRepoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const allowedTags = new Set([
  'audit', 'ethics', 'planning', 'risk', 'control', 'evidence', 'procedures',
  'completion', 'reporting', 'group-audit', 'icfr', 'assurance',
  'question-generation', 'source-map', 'quality',
]);
const requiredFields = ['title', 'created', 'updated', 'type', 'status', 'review_required', 'tags', 'sources', 'confidence'];
const allowedValues = {
  type: ['concept', 'guide', 'source-map', 'coverage', 'question'],
  status: ['generated', 'reviewed'],
  review_required: ['true', 'false'],
  confidence: ['high', 'medium', 'low'],
};
const exemptFrontmatter = new Set(['SCHEMA.md', 'index.md', 'log.md']);
const normalizeLines = text => text.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');

export function allMarkdown(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return entry.name === 'scripts' ? [] : allMarkdown(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

export function parseFrontmatter(text) {
  const normalized = normalizeLines(text);
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z_]+):\s*(.*)$/u);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

function parseInlineArray(value) {
  if (!value?.startsWith('[') || !value.endsWith(']')) return null;
  // Generated pages use JSON arrays; hand-authored metadata uses plain YAML scalars.
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : null;
  } catch {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    const items = inner.match(/"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[^,]+/gu) ?? [];
    const parsed = items.map(item => item.trim().replace(/^(['"])(.*)\1$/u, '$2'));
    return parsed.every(item => item.length > 0) ? parsed : null;
  }
}

function withoutCode(text) {
  let fence;
  return normalizeLines(text).split('\n').map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];
    if (marker && !fence) { fence = marker; return ''; }
    if (marker && marker[0] === fence?.[0] && marker.length >= fence.length) { fence = undefined; return ''; }
    return fence ? '' : line;
  }).join('\n');
}

function headingText(value) {
  return value.replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1').replace(/<[^>]*>/gu, '').replace(/[`*_~]/gu, '').trim();
}

function headingSlug(value) {
  return headingText(value).toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/\s/gu, '-');
}

function anchors(text) {
  const names = new Set();
  const headings = new Set();
  const counts = new Map();
  const body = withoutCode(text);
  for (const match of body.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gmu)) {
    const title = headingText(match[1]);
    const slug = headingSlug(title);
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    names.add(count ? `${slug}-${count}` : slug);
    headings.add(title);
  }
  for (const match of body.matchAll(/<(?:a|span|div)\s[^>]*(?:id|name)=["']([^"']+)["']/giu)) names.add(match[1]);
  return { names, headings };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value ?? '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function wikiTarget(raw) {
  const [target, fragment] = raw.split('|')[0].split('#');
  return { slug: path.basename(target.trim(), '.md'), fragment: fragment?.trim() };
}

export function lintWiki({ repoDir = defaultRepoDir } = {}) {
  const wikiDir = path.join(repoDir, 'cpa_uploader/wiki');
  const files = allMarkdown(wikiDir).sort();
  const pageByBasename = new Map();
  const errors = [];
  const warnings = [];
  const inbound = new Map();
  const anchorCache = new Map();
  const getAnchors = (file) => {
    if (!anchorCache.has(file)) anchorCache.set(file, anchors(fs.readFileSync(file, 'utf8')));
    return anchorCache.get(file);
  };
  const checkAnchor = (file, fragment, label, allowHeading = false) => {
    if (!fragment || path.extname(file).toLowerCase() !== '.md') return;
    let decoded;
    try { decoded = decodeURIComponent(fragment); }
    catch { errors.push(`${label}: anchor 인코딩 오류 #${fragment}`); return; }
    const known = getAnchors(file);
    if (!known.names.has(decoded) && !(allowHeading && known.headings.has(decoded))) errors.push(`${label}: anchor 없음 #${decoded}`);
  };

  for (const file of files) {
    const basename = path.basename(file, '.md');
    if (pageByBasename.has(basename)) errors.push(`중복 basename: ${basename}`);
    pageByBasename.set(basename, file);
    inbound.set(basename, 0);
  }

  for (const file of files) {
    const relative = path.relative(wikiDir, file).split(path.sep).join('/');
    const text = normalizeLines(fs.readFileSync(file, 'utf8'));
    const lines = text.trimEnd().split('\n').length;
    const basename = path.basename(file);
    const frontmatter = parseFrontmatter(text);
    if (!exemptFrontmatter.has(relative)) {
      if (!frontmatter) errors.push(`${relative}: frontmatter 없음`);
      else {
        for (const field of requiredFields) {
          if (!(field in frontmatter)) errors.push(`${relative}: frontmatter ${field} 누락`);
          else if (!frontmatter[field]) errors.push(`${relative}: frontmatter ${field} 비어 있음`);
        }
        for (const [field, allowed] of Object.entries(allowedValues)) {
          if (field in frontmatter && !allowed.includes(frontmatter[field])) errors.push(`${relative}: frontmatter ${field} 값 오류 ${frontmatter[field]}`);
        }
        for (const field of ['created', 'updated']) {
          if (field in frontmatter && !validDate(frontmatter[field])) errors.push(`${relative}: frontmatter ${field} 날짜 오류`);
        }
        if (validDate(frontmatter.created) && validDate(frontmatter.updated) && frontmatter.created > frontmatter.updated) errors.push(`${relative}: updated가 created보다 이전`);
        for (const field of ['tags', 'sources']) {
          const values = parseInlineArray(frontmatter[field]);
          if (!values?.length) { errors.push(`${relative}: ${field}는 비어 있지 않은 문자열 배열이어야 함`); continue; }
          for (const value of values) {
            if (field === 'tags' && !allowedTags.has(value)) errors.push(`${relative}: 허용되지 않은 tag ${value}`);
            if (field === 'sources' && !fs.existsSync(path.resolve(repoDir, value))) errors.push(`${relative}: source 없음 ${value}`);
          }
        }
      }
    }
    if (basename !== 'SCHEMA.md' && !/^[a-z0-9][a-z0-9-]*\.md$/u.test(basename)) errors.push(`${relative}: 파일명 규칙 위반`);
    const body = withoutCode(text);
    const wikilinks = [...body.matchAll(/\[\[([^\]]+)\]\]/gu)].map(match => wikiTarget(match[1]));
    if (!exemptFrontmatter.has(relative) && wikilinks.length < 2) errors.push(`${relative}: outbound wikilink가 2개 미만`);
    for (const { slug, fragment } of wikilinks) {
      const resolved = slug ? pageByBasename.get(slug) : file;
      if (!resolved) errors.push(`${relative}: 깨진 wikilink [[${slug}]]`);
      else {
        const target = path.basename(resolved, '.md');
        inbound.set(target, (inbound.get(target) ?? 0) + 1);
        checkAnchor(resolved, fragment, relative, true);
      }
    }
    // Local checks never fetch remote URLs.
    for (const match of body.matchAll(/\[[^\]\n]+\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*["'])?\s*\)/gu)) {
      const raw = match[1].replace(/^<|>$/gu, '');
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(raw)) continue;
      const [target, fragment] = raw.split('#');
      let decoded;
      try { decoded = decodeURIComponent(target.split('?')[0]); }
      catch { errors.push(`${relative}: link 인코딩 오류 ${raw}`); continue; }
      const resolved = decoded ? path.resolve(path.dirname(file), decoded) : file;
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) errors.push(`${relative}: source link 없음 ${raw}`);
      else checkAnchor(resolved, fragment, relative);
    }
    if (lines > 400) errors.push(`${relative}: ${lines}줄로 hard limit 400 초과`);
    else if (lines > 200) warnings.push(`${relative}: ${lines}줄, 분할 검토 권장`);
  }

  const indexPath = path.join(wikiDir, 'index.md');
  const indexText = fs.existsSync(indexPath) ? withoutCode(fs.readFileSync(indexPath, 'utf8')) : '';
  if (!indexText) errors.push('index.md 없음 또는 비어 있음');
  const indexed = new Set([...indexText.matchAll(/\[\[([^\]]+)\]\]/gu)].map(match => wikiTarget(match[1]).slug));
  for (const file of files) {
    const relative = path.relative(wikiDir, file).split(path.sep).join('/');
    if (exemptFrontmatter.has(relative)) continue;
    const slug = path.basename(file, '.md');
    if (!indexed.has(slug)) errors.push(`index.md: [[${slug}]] 누락`);
    if (!inbound.get(slug)) errors.push(`orphan page: ${slug}`);
  }
  return {
    wikiDir, markdownFiles: files.length,
    contentPages: files.filter(file => !exemptFrontmatter.has(path.relative(wikiDir, file).split(path.sep).join('/'))).length,
    errors, warnings,
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = lintWiki();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
