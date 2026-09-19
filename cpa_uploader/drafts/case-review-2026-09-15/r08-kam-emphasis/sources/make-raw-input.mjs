// r08 raw 수집 입력을 만든다(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   node cpa_uploader/drafts/case-review-2026-09-15/r08-kam-emphasis/sources/make-raw-input.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const RAW = 'cpa_uploader/raw/originals/case-review-2026-09-15';
const S = 'cpa_uploader/drafts/case-review-2026-09-15/r08-kam-emphasis/sources';
const lineage = 'r08(52번 핵심감사사항·강조사항 종합 대체)에 쓴 KGA 701 문단 A10·A11·A18·A21·A27·A28·A40·A46·A47·A51과 KGA 706 문단 A16·A18 발췌, 2025 공식 PDF 727·729·730·731·734·736·737·777·778쪽 재추출·쪽 이미지 대조 계보';
const pages = [727, 729, 730, 731, 734, 736, 737, 777, 778];
const entries = [
    { original_path: `${RAW}/kga701-706-2025-excerpts.md`, category: 'official', role: lineage },
    { original_path: 'cpa_uploader/data/official/case-review-2026-09-15-kga701-706.md', category: 'official', role: 'r08에서 새로 등록한 KGA 701·706 발췌본(raw 원본과 같은 바이트)' },
    { original_path: `${RAW}/kga701-706-2025-excerpts.provenance.json`, category: 'verification', role: lineage },
    ...pages.flatMap((page) => ['txt', 'png'].map((ext) => ({ original_path: `${RAW}/kga701-706-2025-page-${page}.${ext}`, category: 'verification', role: lineage }))),
    { original_path: `${S}/render-kga701-706-pages.py`, category: 'verification', role: 'r08: 원본 PDF 쪽 재추출·렌더링 도구' },
    { original_path: `${S}/extract-kga701-706.mjs`, category: 'verification', role: 'r08: KGA 701·706 발췌본과 계보를 만든 도구' },
    { original_path: 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf', category: 'verification', role: 'r08 사례의 직접 대조에 사용한 기존 출처의 바이트 보존' },
    { original_path: 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', category: 'verification', role: 'r08 사례의 직접 대조에 사용한 기존 출처의 바이트 보존(2025 전문 KGA 701·705·706 통독)' },
    { original_path: 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt', category: 'verification', role: 'r08 사례의 직접 대조에 사용한 기존 출처의 바이트 보존(2026 전문 KGA 701·706 대조)' },
    { original_path: 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt', category: 'official', role: 'r08 사례의 직접 대조에 사용한 기존 출처의 바이트 보존(KGA 701 문단 4·9~15, KGA 706 문단 7~9·12·A1~A3)' },
    { original_path: 'cpa_uploader/data/official/delegated-s05-kga-2025.txt', category: 'official', role: 'r08 사례의 직접 대조에 사용한 기존 출처의 바이트 보존(KGA 701 문단 18)' },
    { original_path: 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md', category: 'learning', role: 'r08 사례의 직접 대조에 사용한 기존 출처의 바이트 보존(2021 제56회 문제 5·6, 2022 제57회 문제 7, 2023 제58회 문제 10 물음 4, 2024 제59회 문제 10 물음 5, 2025 제60회 문제 10)' },
].map((entry) => ({ original_path: entry.original_path, sha256: sha(entry.original_path), category: entry.category, role: entry.role }));
fs.writeFileSync(`${S}/raw-collection-input.json`, JSON.stringify({ version: 1, entries }, null, 2) + '\n', { flag: 'wx' });
console.log(entries.length, 'entries');
