import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';

const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const specs = [
    ['r01','cpa_uploader/drafts/frequency-priority-2026-09-10/sources/official-excerpts.txt','cpa_uploader/data/official/delegated-r01-kga-2025.txt','최신 대조: cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/sources/official-comparison.json. 2025/2026 공식 다운로드·동일문단 및 시행일 재확인.'],
    ['r02','cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/sources/kga260-2026-context.txt','cpa_uploader/data/official/delegated-r02-kga260-2026.txt','출처 근거: cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/source-evidence.json.'],
    ['n01','cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/sources/kga200-210-230-2025-excerpt.txt','cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt','공식 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06\n출처 비교: cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/sources/kga-edition-comparison.json. 2025/2026 공식 전문 대응 문단 대조.'],
    ['n01','cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/sources/ethics-2024-excerpt.txt','cpa_uploader/data/official/delegated-n01-ethics-2024.txt','출처: KICPA 공인회계사윤리기준 2024.12.19 의결, 2025.01.01 시행. 다운로드 URL·해시: cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/sources/ethics-download-provenance.json. 2026 공개초안은 확정 기준으로 적용하지 않음.'],
];
const records=[];
for(const [owner,input,output,note] of specs){
    const original=fs.readFileSync(input,'utf8');
    const body=original.replace(/^=== PDF page (\d+) ===$/gm,'## PDF PAGE $1').replace(/^## PDF page (\d+)$/gm,'## PDF PAGE $1');
    const content=`확인일: 2026-09-11. 2027년 CPA 시험 대비, 2026-01-01 개시 보고기간을 기본 사례로 적용.\n${note}\n원본 발췌: ${input}\n원본 발췌 SHA-256: ${sha(original)}\n원문 내용은 보존하고 페이지 색인 표기만 카탈로그 문법으로 변경함.\n\n${body}`;
    fs.writeFileSync(output,content,{flag:'wx'});
    records.push({owner,input,input_sha256:sha(original),output,output_sha256:sha(content)});
}
const catalog=buildSourceCatalog();
const units=catalog.units.filter(unit=>records.some(r=>r.output===unit.file)).map(({id,file,standard,paragraph,topicIds,locator,contentHash})=>({id,file,standard,paragraph,topicIds,locator,contentHash}));
fs.writeFileSync(`${control}/source-registration-initial.json`,JSON.stringify({created_at:new Date().toISOString(),records,catalog_fingerprint:catalog.fingerprint,units},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({registered:records.length,units:units.length,ethics:units.filter(u=>u.standard==='공인회계사윤리기준').map(u=>({id:u.id,paragraph:u.paragraph}))}));
