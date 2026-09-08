import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='docs/reports/question-review-2027/grading-cases';
const a=JSON.parse(fs.readFileSync('tmp/question-review-15/pages-2025.json'));
const b=JSON.parse(fs.readFileSync('tmp/question-review-15/pages-2026.json'));
const trim=t=>t.replace(/^감사기준서[^\n]*\n\s*\d+ \/ \d+\s*\n/,'').trim();
function part(page,start,end){const t=trim(a[page]);const i=t.indexOf(start),j=end?t.indexOf(end,i+start.length):t.length;if(i<0||j<0)throw Error(start);return t.slice(i,j).trim();}
const quotes={
 '700.13':part(675,'13.','\n \n8 ')+ '\n'+part(676,'(a)','\n14.'),
 '700.14':part(676,'14.','\n15.'),'700.15':part(676,'15.','\n의견의 형태'),
 '700.23':part(677,'23.','\n24.'),'700.28':part(678,'28.','\n계속기업'),
 '705.5a':part(743,'5.','\n(b) 변형의견'),
 '705.7':part(743,'7.'),'705.8-9':part(744,'8.','\n10.'),
 '705.20':part(746,'20.'),'705.21':part(747,'21.','\n22.'),
 '705.23':part(747,'23.','\n24.'),'705.24':part(747,'24.','\n25.'),
 '705.28':part(748,'28.','\n감사인이 재무제표에 대하여 의견을 거절하는 경우 고려사항'),
 '705.29':part(748,'29.','\n지배기구와의 커뮤니케이션'),
 '705.30':part(748,'30.','\n  \n'),
};
const pages=[675,676,677,678,742,743,744,745,746,747,748,754];
const norm=t=>trim(t).replace(/\s/g,'');
const comparison=pages.map(p=>({page2025:p,page2026:p+27,equal_ignoring_page_header_and_whitespace:norm(a[p])===norm(b[p+27])}));
fs.writeFileSync(`${dir}/15-source-quotes.json`,JSON.stringify(quotes,null,2)+'\n');
fs.writeFileSync(`${dir}/15-source-comparison.json`,JSON.stringify({checked:'2026-09-08',comparison,hashes:Object.fromEntries(['tmp/question-review-06/kga-2025.pdf','tmp/question-review-02/standards-2026.pdf'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))},null,2)+'\n');
fs.writeFileSync('cpa_uploader/data/official/kga700-705-2025-review15.txt','한국공인회계사회 회계감사기준 전문(2025 개정), 2026 시행 기준. 직접 발췌. 쪽 머리말·꼬리말 제외; 인용의 줄바꿈 보존.\n'+['700','705'].map(code=>`\n# KGA ${code}: 주제15 직접 출처\n`+Object.entries(quotes).filter(([k])=>k.startsWith(code)).map(([k,t])=>`\n[${k}]\n${t}\n`).join('')).join(''));
console.log(comparison);
