import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSourceCatalog } from '../../../../../questionSourceCatalog.mjs';

const repo = process.cwd();
const out = path.dirname(fileURLToPath(import.meta.url));
const outRel = path.relative(repo, out).replaceAll('\\', '/');
const slash = x => x.replaceAll('\\', '/');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const skipDirs = new Set(['.git', 'node_modules', '.next', '.venv', '__pycache__', 'raw']);
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const x of fs.readdirSync(dir, { withFileTypes: true })) {
  const p = path.join(dir, x.name), rel = slash(path.relative(repo, p));
    if (x.isDirectory()) { if (!skipDirs.has(x.name) && !rel.startsWith(outRel) && !rel.includes('/tools/python/') && !/\/b\/.*fixture/i.test(rel)) walk(p, acc); }
    else if (x.isFile()) acc.push(rel);
  }
  return acc;
}
const all = walk(repo).sort();
const catalog = buildSourceCatalog({ repoDir: repo });
const sources = new Map(catalog.sources.map(x => [x.file, x]));
const selected = new Map();
const add = (p, category, role) => selected.set(p, {original_path:p, category, role});
for (const p of all) {
  if (p.startsWith('cpa_uploader/data/회계감사_통합학습자료/')) add(p, /^99_/.test(path.basename(p)) ? 'verification' : 'learning', /^99_/.test(path.basename(p)) ? '학습 원문 OCR·구조·교정 검증 자료' : 'wiki 기반 통합 학습자료·목차·자료 설명');
  else if (p.startsWith('cpa_uploader/references/') && p.endsWith('.md')) add(p, 'reference', '별도 보관된 기준서·윤리·법규 참고 원문 Markdown');
  else if (p.startsWith('cpa_uploader/data/official/')) add(p, 'official', '현재 등록 공식 전사·발췌; 판본 승인과 구분');
  else if (/\/sources\//.test(p) && /\.(?:pdf|docx?|hwp|hwpx|html?|txt|png|jpe?g|webp|md)$/i.test(p)) {
    const ext = path.extname(p).toLowerCase();
    add(p, 'verification', ['.pdf','.docx','.hwp','.hwpx','.doc'].includes(ext) ? '검증에 확보한 원문 문서' : ['.png','.jpg','.jpeg','.webp'].includes(ext) ? '검증한 원문 페이지 이미지' : ['.html','.htm'].includes(ext) ? '공식 게시·법령·다운로드 경로 확인 응답 보존본; 실제 내용 여부 개별 확인' : '원문 전문·선택 페이지 추출 또는 검증용 발췌 전사');
  } else if (/\/evidence\/phase1\/pdf-page-\d+-independent\.txt$/.test(p)) add(p, 'verification', '별도 PDF 추출기로 원문 페이지를 독립 추출한 검증 텍스트');
  else if (/\/official-source-remediation-v1\/point-review-[abc]-source-followup-.*\.txt$/.test(p)) add(p, 'verification', '공식 전사 등록 전 바이트 보존 stage 사본');
  else if (/\/s03\/official-excerpts-202[56]\.txt$/.test(p) || /\/point-review-and-publication-2026-09-11\/a\/source-evidence\.txt$/.test(p)) add(p, 'verification', 'sources 폴더 밖 실제 공식 인용 보완 원자료');
}
const wikiInputs = [
  'cpa_uploader/config/question-source-registry.json',
  'cpa_uploader/analysis/question-elements/past-exam.json',
  'cpa_uploader/analysis/question-elements/practice.json',
  'cpa_uploader/analysis/question-elements/ox.json',
  'cpa_uploader/analysis/question-elements/normalization.json',
  'cpa_uploader/analysis/coverage/links.json',
  'cpa_uploader/analysis/reviews/question-review-2027/standards-register.json',
  'cpa_uploader/analysis/reviews/question-review-2027/grading-cases/19-sources.json',
];
wikiInputs.push(...all.filter(p => /^cpa_uploader\/analysis\/question-elements\/curation-.*\.json$/.test(p)));
for (const p of wikiInputs) if (fs.existsSync(path.join(repo,p))) add(p,'wiki-input','wiki·카탈로그·빈도·관계의 수동 입력 또는 공식 출처 판본 메타데이터; 원문 내용과 구분');
for (const p of all.filter(p => p.startsWith('cpa_uploader/') && p.endsWith('.json') && !p.includes('/phase-two') && !p.includes('/phase2/') && !p.includes('/execution-') && !p.includes('/runtime-') && !p.includes('/prepared-reviewed-') && !p.includes('/prior') && !p.includes('/evidence/before') && !p.includes('/semantic-'))) {
  if (/\/sources\//.test(p)) add(p,'verification','검증용 원자료 추출·원자료 위치/판본/해시 보관 JSON; 생성 문항이나 모델 응답과 구분');
  else if (/\/(?:source-registration[^/]*|official-source-registration-[abc]-v1|abc-source-evidence|e-source-evidence|stage-evidence)\.json$/.test(p)) add(p,'verification','공식 출처 다운로드·추출·등록 사본의 원경로/해시/문단 계보 JSON');
}

const records = all.filter(p => /\.(json|md|mjs|py|ts)$/.test(p) && !p.includes('/phase-two') && !p.includes('/phase2/') && !p.includes('/semantic-') && !p.includes('/execution-') && !p.includes('/runtime-') && !p.includes('/node_modules/') && !p.startsWith('cpa_uploader/wiki/') && !p.startsWith('cpa_uploader/data/') && !p.includes('/prepared-reviewed-') && (/source|edition|download|extract|migration-manifest|원자료|출처|판본/.test(p) || p.endsWith('/README.md')))
  .filter(p => fs.statSync(path.join(repo,p)).size < 4000000)
  .map(p => { const text = fs.readFileSync(path.join(repo,p),'utf8'); return {file:p,text,sha256:hash(text)}; });
const cleanURL = u => u.replace(/[),.;\]}>]+$/g,'');
const urlRx = /https?:\/\/[^\s<>"'`\\]+/g;
const migrations = [];
for (const rec of records.filter(x => x.file.includes('migration-manifest'))) {
  try { const j = JSON.parse(rec.text); migrations.push({file:rec.file,body:j}); } catch {}
}
const migrationMap = new Map(migrations.flatMap(m => (m.body.entries||[]).filter(e=>e.old_path&&e.new_path).map(e=>[slash(e.old_path),slash(e.new_path)])));
function resolveRecorded(p, record) { p=slash(p); const seen=new Set(); while(migrationMap.has(p)&&!seen.has(p)){seen.add(p);p=migrationMap.get(p);} if(record&&!fs.existsSync(path.resolve(repo,p))){const local=slash(path.relative(repo,path.resolve(repo,path.dirname(record),p)));if(fs.existsSync(path.resolve(repo,local)))return local;}return p; }
const directURLs = new Map(), lineage=[], unresolvedRecords=[];
function inspectRecord(node, rec, pointer='') {
  if (!node || typeof node!=='object') return;
  if (!Array.isArray(node)) {
    const fileFields=Object.entries(node).filter(([k,v])=>typeof v==='string' && /(?:^file$|^path$|file$|^input$|^output$|^source_pdf$)/.test(k) && /\.(?:pdf|docx?|hwp|hwpx|txt|md|html?|png|json)$/.test(v));
    const urls=Object.entries(node).filter(([k,v])=>typeof v==='string'&&/^https?:\/\//.test(v)&&/(url|uri|source)/.test(k));
    for(const [k,p] of fileFields) {
      const resolved=resolveRecorded(p,rec.file);
      if (selected.has(resolved)&&urls.length) directURLs.set(resolved,[...(directURLs.get(resolved)||[]),...urls.map(([key,url])=>({url,record:rec.file,pointer:pointer+'/'+key,file_field:k,recorded_path:p}))]);
      if (urls.length && !fs.existsSync(path.resolve(repo,resolved))) unresolvedRecords.push({record:rec.file,pointer,recorded_path:p,resolved_path:resolved,urls:urls.map(([,u])=>u),status:'recorded_file_not_present'});
    }
    if (typeof node.input==='string'&&typeof node.output==='string' && selected.has(resolveRecorded(node.input))&&selected.has(resolveRecorded(node.output))) lineage.push({from:resolveRecorded(node.input),to:resolveRecorded(node.output),relation:'recorded_registration_input_output',record:rec.file,pointer});
    if (typeof node.staged_file==='string'&&typeof node.target_file==='string' && selected.has(resolveRecorded(node.staged_file))&&selected.has(resolveRecorded(node.target_file))) lineage.push({from:resolveRecorded(node.staged_file),to:resolveRecorded(node.target_file),relation:'recorded_stage_registration',record:rec.file,pointer});
  }
  for(const [k,v] of Object.entries(node)) if(v&&typeof v==='object')inspectRecord(v,rec,pointer+'/'+k);
}
for(const rec of records.filter(r=>r.file.endsWith('.json')&&!r.file.startsWith('.claude/')&&!r.file.startsWith('tmp/'))){try{inspectRecord(JSON.parse(rec.text),rec);}catch{}}
const entries = [...selected.values()].sort((a,b)=>a.original_path.localeCompare(b.original_path));
for (const e of entries) {
  const b = fs.readFileSync(path.join(repo,e.original_path)); e.bytes=b.length; e.sha256=hash(b);
  const c = sources.get(e.original_path); e.catalog_source_id=c?.id??null; e.catalog_unit_count=c?.unitIds.length??0;
  const readable = /\.(txt|md|html?|json)$/i.test(e.original_path);
  const text = readable ? b.toString('utf8') : '';
  e.documented_urls = [...new Set((text.split(/\r?\n/).slice(0,18).join('\n').match(urlRx)||[]).map(cleanURL))].filter(u=>!/^https?:\/\/(?:www\.)?w3\.org/.test(u));
  e.provenance_records = records.filter(r => r.text.includes(e.original_path) || (r.text.includes(path.basename(e.original_path)) && (r.file.startsWith(path.dirname(e.original_path).replace(/\/sources$/, '')) || /source-registration|migration-manifest|standards-register/.test(r.file))))
    .map(r => ({file:r.file,sha256:r.sha256}));
  e.url_status=e.documented_urls.length?'URL present in preserved source header; origin versus navigation requires provenance reading':'No original URL in source header; consult linked provenance records';
  e.recorded_url_links=directURLs.get(e.original_path)||[];
  e.original_url_present=e.recorded_url_links.length>0||e.documented_urls.length>0;
  if(e.recorded_url_links.length)e.url_status='URL is paired with this recorded file in linked provenance JSON; no fresh network verification';
  if(e.original_path.startsWith('.claude/')||e.original_path.startsWith('tmp/'))e.copy_context='과거 worktree/배포 체크아웃에 남은 보존 사본; 현행 출처 계약과 구분';
  e.content_form= /\.(pdf|docx?|hwp|hwpx)$/i.test(e.original_path)?'original_document':/\.(png|jpe?g|webp)$/i.test(e.original_path)?'page_image':/\.html?$/i.test(e.original_path)?'saved_web_response':e.category==='wiki-input'?'metadata_input':e.original_path.endsWith('.json')?'source_provenance_or_extraction_json':/^99_/.test(path.basename(e.original_path))?'source_quality_record':e.category==='learning'?'integrated_learning_transcription':'text_transcription_or_excerpt';
}
const byHash = new Map(); for (const e of entries) byHash.set(e.sha256,[...(byHash.get(e.sha256)||[]),e.original_path]);
const duplicates=[...byHash].filter(([,p])=>p.length>1).map(([sha256,original_paths])=>({sha256,original_paths}));
const potentialRaw = all.filter(p=>/\.(pdf|docx?|hwp|hwpx|html?|txt|png|jpe?g|webp|zip)$/i.test(p));
const excluded = potentialRaw.filter(p=>!selected.has(p)).map(p=>({original_path:p,reason:p.includes('/code/')||/\.before\.txt$|\.mjs\.txt$|\.ts\.txt$/.test(p)?'실행 코드·설정 snapshot; 자료 원문 아님':p.startsWith('tests/')?'프로그램 테스트 fixture; 회계감사 wiki 원문 아님':/contact-\d+\.png$/.test(p)?'앱 화면 검증 캡처; 기준서 페이지 원문 아님':p.includes('/prior')||p.endsWith('.zip')?'기존 문항·계획·QA 묶음의 보존 snapshot':p.includes('/release/')?'승급·실행 증거 설명; 자료 원문 아님':'실행 출력 또는 검토 메모 후보; 원문인지 별도 대조 필요'}));
const generatedGroups = [
 {path:'cpa_uploader/wiki/{_meta,concepts,questions,raw}/',reason:'생성 탐색·세트 색인·manifest; 원자료 복제 대상으로 취급하지 않음'},
 {path:'cpa_uploader/data/cpa_question_sets_v3.*.json',reason:'문항 정본·공개본·승급 ledger. 원문 출처가 아니므로 이 원자료 후보목록에서 제외; 실제 wiki 읽기 입력의 시점 사본은 A 별도 wiki-input 목록과 통합 판단'},
 {path:'cpa_uploader/data/learning-question-classifications.json',reason:'물음 분류 메타데이터; 원문 자료 아님'},
 {path:'cpa_uploader/analysis/question-elements/{elements,frequency,dedup,summary}.*',reason:'추출·빈도 생성물, 수동 입력과 구분'},
 {path:'cpa_uploader/analysis/coverage/{registry,summary,topics}/',reason:'관계 입력을 읽은 생성물'},
 {path:'cpa_uploader/{drafts,analysis/reviews}/**/{semantic,review,qa,raw,attempt,receipt,packet,plan}*.json',reason:'문항·모델 응답·검수·채점·실행 자료; source_refs로 가리킨 실제 원자료만 위 entries에 포함'},
 {path:'cpa_uploader/wiki/question-generation/',reason:'사람 작성 출제 지침. 현재 원위치 유지·링크로 보존; 외부 원문 아님'},
];
const summary={measured_at:new Date().toISOString(),read_only:true,api_calls:0,repository_files_scanned:all.length,source_catalog_files:catalog.sources.length,source_catalog_units:catalog.units.length,entries:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0),unique_sha256:byHash.size,exact_duplicate_groups:duplicates.length,categories:Object.fromEntries([...new Set(entries.map(e=>e.category))].map(k=>[k,entries.filter(e=>e.category===k).length])),content_forms:Object.fromEntries([...new Set(entries.map(e=>e.content_form))].map(k=>[k,entries.filter(e=>e.content_form===k).length])),catalog_files_not_selected:catalog.sources.filter(s=>!selected.has(s.file)).map(s=>s.file),provenance_records_scanned:records.length,scope:'Files present in repository, including gitignored files; no source copying/moving or byte changes. External originals and independently discovered JSON source extracts are follow-up entries.'};
fs.mkdirSync(out,{recursive:true});
for(const [file,obj] of Object.entries({'candidates.json':{version:1,...summary,entries},'duplicates.json':{version:1,groups:duplicates},'exclusions.json':{version:1,files:excluded,groups:generatedGroups},'summary.json':summary,'provenance-records.json':{entries:records.map(({file,sha256})=>({file,sha256}))},'lineage.json':{migration_manifests:migrations.map(m=>m.file),relations:lineage},'missing-recorded-files.json':{entries:unresolvedRecords}})) fs.writeFileSync(path.join(out,file),JSON.stringify(obj,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
