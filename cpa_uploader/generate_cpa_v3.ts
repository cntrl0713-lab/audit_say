import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import {
    compilePublicQuestionSet,
    validateQuestionSetV3,
} from '../lib/questionV3.ts';
import type {
    QuestionSetV3,
    SourceRefV3,
} from '../lib/questionV3.ts';

interface TopicDefinition {
    id: string;
    slug: string;
    title: string;
    standards: string[];
    keywords: string[];
    part: string;
    chapter: string;
    domain: QuestionSetV3['classification']['domain'];
}

interface SourceCandidate extends SourceRefV3 {
    score: number;
}

const ROOT = process.cwd();
const STANDARD_DIR = path.join(
    ROOT,
    'cpa_uploader/data/회계감사_통합학습자료/01_감사기준',
);
const BASIC_THEORY_DIR = path.join(
    ROOT,
    'cpa_uploader/data/회계감사_통합학습자료/02_기본이론',
);
const WIKI_CONCEPT_DIR = path.join(ROOT, 'cpa_uploader/wiki/concepts');
const OUTPUT_DIR = path.join(ROOT, 'cpa_uploader/data');
const AUTHORING_PATH = path.join(OUTPUT_DIR, 'cpa_question_sets_v3.authoring.json');
const PUBLIC_PATH = path.join(OUTPUT_DIR, 'cpa_question_sets_v3.public.json');
const CHECKPOINT_PATH = path.join(OUTPUT_DIR, 'cpa_question_sets_v3.checkpoint.json');

const TOPICS: TopicDefinition[] = [
    { id: '01', slug: 'ethics-independence-quality', title: '윤리·독립성·품질관리', standards: ['200', '220'], keywords: ['윤리적 요구사항', '독립성', '품질관리', '업무품질관리', '모니터링'], part: 'PART1', chapter: '감사인의 책임과 품질관리', domain: 'ethics' },
    { id: '02', slug: 'audit-objectives-foundations', title: '감사의 목적과 기본원칙', standards: ['200'], keywords: ['합리적인 확신', '감사위험', '전문가적 의구심', '전문가적 판단', '고유한계'], part: 'PART1', chapter: '회계감사의 기초', domain: 'audit' },
    { id: '03', slug: 'engagement-acceptance-contract', title: '감사업무 수임과 계약', standards: ['210'], keywords: ['감사업무 조건', '감사계약', '감사의 전제조건', '수임', '계속감사'], part: 'PART1', chapter: '감사업무 수임', domain: 'audit' },
    { id: '04', slug: 'planning-documentation-materiality', title: '감사계획·문서화·중요성', standards: ['230', '300', '320'], keywords: ['감사문서', '감사조서', '감사전략', '감사계획', '중요성', '수행중요성'], part: 'PART2', chapter: '감사계획과 중요성', domain: 'audit' },
    { id: '05', slug: 'fraud-laws-governance-communication', title: '부정·법규·지배기구 커뮤니케이션', standards: ['240', '250', '260', '265'], keywords: ['부정', '법률과 규정', '법규', '지배기구', '내부통제 미비점', '커뮤니케이션'], part: 'PART2', chapter: '부정과 커뮤니케이션', domain: 'audit' },
    { id: '06', slug: 'risk-assessment-internal-control', title: '위험평가와 내부통제', standards: ['315'], keywords: ['중요왜곡표시위험', '위험평가절차', '내부통제시스템', '통제환경', '정보시스템', '통제활동'], part: 'PART2', chapter: '위험평가', domain: 'internal_control' },
    { id: '07', slug: 'responses-controls-substantive-procedures', title: '위험 대응과 추가감사절차', standards: ['330'], keywords: ['평가된 위험', '추가감사절차', '통제테스트', '실증절차', '실증분석절차', '세부테스트'], part: 'PART2', chapter: '위험에 대한 대응', domain: 'audit' },
    { id: '08', slug: 'audit-evidence-assertions', title: '감사증거와 경영진주장', standards: ['500'], keywords: ['감사증거', '충분하고 적합', '경영진주장', '신뢰성', '감사절차'], part: 'PART3', chapter: '감사증거', domain: 'audit' },
    { id: '09', slug: 'inventory-litigation-confirmations-opening-balances', title: '재고·소송·외부조회·기초잔액', standards: ['501', '505', '510'], keywords: ['재고자산', '소송과 배상청구', '외부조회', '조회서', '기초잔액', '초도감사'], part: 'PART3', chapter: '특정항목 감사증거', domain: 'audit' },
    { id: '10', slug: 'analytics-audit-sampling', title: '분석적절차와 표본감사', standards: ['520', '530'], keywords: ['분석적절차', '표본감사', '감사표본', '표본위험', '표본크기', '모집단'], part: 'PART3', chapter: '분석적절차와 표본감사', domain: 'audit' },
    { id: '11', slug: 'estimates-related-parties', title: '회계추정과 특수관계자', standards: ['540', '550'], keywords: ['회계추정', '추정불확실성', '공정가치', '특수관계자', '특수관계'], part: 'PART3', chapter: '회계추정과 특수관계자', domain: 'audit' },
    { id: '12', slug: 'completion-subsequent-events-going-concern', title: '감사종결·후속사건·계속기업', standards: ['450', '560', '570', '580'], keywords: ['미수정왜곡표시', '후속사건', '계속기업', '서면진술', '왜곡표시의 평가'], part: 'PART3', chapter: '감사종결', domain: 'audit' },
    { id: '13', slug: 'service-organizations-internal-audit-experts', title: '서비스조직·내부감사·전문가 활용', standards: ['402', '610', '620'], keywords: ['서비스조직', '수탁회사', '내부감사기능', '내부감사인', '감사인측 전문가', '전문가의 업무'], part: 'PART3', chapter: '타인의 업무 활용', domain: 'audit' },
    { id: '14', slug: 'group-audit', title: '그룹감사', standards: ['600'], keywords: ['그룹재무제표', '그룹감사', '그룹업무팀', '부문감사인', '부문재무정보', '연결절차'], part: 'PART4', chapter: '그룹감사', domain: 'audit' },
    { id: '15', slug: 'audit-opinions-reports', title: '감사의견과 감사보고서', standards: ['700', '705'], keywords: ['감사의견', '감사보고서', '적정의견', '한정의견', '부적정의견', '의견거절', '의견변형'], part: 'PART4', chapter: '감사의견과 보고', domain: 'audit' },
    { id: '16', slug: 'kam-emphasis-comparatives-other-information', title: '핵심감사사항·강조사항·비교정보·기타정보', standards: ['701', '706', '710', '720'], keywords: ['핵심감사사항', '강조사항문단', '기타사항문단', '비교정보', '대응수치', '비교재무제표', '기타정보'], part: 'PART4', chapter: '감사보고의 특수사항', domain: 'audit' },
    { id: '17', slug: 'internal-control-over-financial-reporting', title: '내부회계관리제도 감사', standards: ['1100'], keywords: ['내부회계관리제도', '운영실태보고서', '전사적 수준 통제', '내부회계'], part: 'PART4', chapter: '내부회계관리제도', domain: 'internal_control' },
    { id: '18', slug: 'small-entity-audit', title: '소규모기업 감사', standards: ['1200'], keywords: ['소규모기업', '소규모 기업'], part: 'PART4', chapter: '소규모기업 감사', domain: 'audit' },
    { id: '19', slug: 'assurance-review-related-services', title: '인증·검토·관련서비스', standards: [], keywords: ['인증업무(Assurance service)', '합리적 확신업무', '제한적 확신업무', '합의된 절차 수행업무', '검토업무'], part: 'PART4', chapter: '기타 인증과 관련서비스', domain: 'other' },
];

const QUESTION_SET_RESPONSE_SCHEMA: unknown = {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'id', 'type', 'status', 'title', 'classification', 'source_refs', 'shared_context', 'learning_order', 'subquestions', 'verification'],
    properties: {
        schema_version: { type: 'string' },
        id: { type: 'string' },
        type: { type: 'string' },
        status: { type: 'string' },
        title: { type: 'string' },
        classification: {
            type: 'object',
            additionalProperties: false,
            required: ['topic_id', 'part', 'chapter', 'domain', 'standards', 'tags'],
            properties: {
                topic_id: { type: 'string' },
                part: { type: 'string' },
                chapter: { type: 'string' },
                domain: { type: 'string' },
                standards: { type: 'array', items: { type: 'string' } },
                tags: { type: 'array', items: { type: 'string' } },
            },
        },
        source_refs: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'file', 'source_quote', 'role'],
                properties: {
                    id: { type: 'string' },
                    file: { type: 'string' },
                    title: { type: 'string' },
                    page: { type: 'string' },
                    source_quote: { type: 'string' },
                    role: { type: 'string' },
                    content_hash: { type: 'string' },
                },
            },
        },
        shared_context: {
            type: 'object',
            additionalProperties: false,
            required: ['facts'],
            properties: {
                facts: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['id', 'text', 'scoreable'],
                        properties: {
                            id: { type: 'string' },
                            text: { type: 'string' },
                            scoreable: { type: 'boolean' },
                        },
                    },
                },
            },
        },
        learning_order: { type: 'array', items: { type: 'string' } },
        subquestions: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'type', 'prompt', 'constraints', 'selection', 'model_answer', 'requirements', 'criteria'],
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['descriptive', 'enumeration', 'judgment'] },
                    prompt: { type: 'string' },
                    constraints: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['ordered', 'max_entries', 'overflow_policy'],
                        properties: {
                            ordered: { type: 'boolean' },
                            max_entries: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                            overflow_policy: { type: 'string', enum: ['none', 'ignore_after_limit'] },
                        },
                    },
                    selection: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['type', 'n'],
                        properties: {
                            type: { type: 'string', enum: ['all', 'best_n', 'at_least_n'] },
                            n: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                        },
                    },
                    model_answer: { type: 'array', minItems: 1, items: { type: 'string' } },
                    requirements: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['id', 'source_ref_id', 'source_quote'],
                            properties: {
                                id: { type: 'string' },
                                source_ref_id: { type: 'string' },
                                source_quote: { type: 'string' },
                                source_span: { type: 'string' },
                            },
                        },
                    },
                    criteria: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['id', 'requirement_id', 'claim', 'critical_facts', 'max_points', 'scores', 'source_ref_ids'],
                            properties: {
                                id: { type: 'string' },
                                requirement_id: { type: 'string' },
                                claim: { type: 'string' },
                                critical_facts: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['id', 'type', 'expected'],
                                        properties: {
                                            id: { type: 'string' },
                                            type: { type: 'string', enum: ['actor', 'condition', 'action', 'conclusion', 'number', 'negation'] },
                                            expected: { type: 'string' },
                                        },
                                    },
                                },
                                max_points: { type: 'integer', enum: [1, 2, 3] },
                                scores: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['met', 'not_met', 'contradicted'],
                                    properties: {
                                        met: { type: 'integer' },
                                        partial: { type: 'integer' },
                                        not_met: { type: 'integer' },
                                        contradicted: { type: 'integer' },
                                    },
                                },
                                source_ref_ids: { type: 'array', minItems: 1, items: { type: 'string' } },
                            },
                        },
                    },
                },
            },
        },
        verification: {
            type: 'object',
            additionalProperties: false,
            required: ['source_fidelity', 'review_status', 'calculation_required', 'notes'],
            properties: {
                source_fidelity: { type: 'string' },
                review_status: { type: 'string' },
                calculation_required: { type: 'boolean' },
                notes: { type: 'array', items: { type: 'string' } },
            },
        },
    },
};

function normalize(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function hash(value: string): string {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function toSourceRef(candidate: SourceCandidate): SourceRefV3 {
    return {
        id: candidate.id,
        file: candidate.file,
        ...(candidate.title ? { title: candidate.title } : {}),
        ...(candidate.page ? { page: candidate.page } : {}),
        source_quote: candidate.source_quote,
        role: candidate.role,
        ...(candidate.content_hash ? { content_hash: candidate.content_hash } : {}),
    };
}

function standardFiles(): string[] {
    return fs.readdirSync(STANDARD_DIR)
        .filter((name) => name.endsWith('.md'))
        .map((name) => path.join(STANDARD_DIR, name));
}

function currentStandardFromHeading(line: string, previous: string | null): string | null {
    const match = line.match(/^#{1,2}\s*(?:감사기준서|KGA)\s*(\d{3,4})\b/i);
    return match?.[1] ?? previous;
}

function selectDiverseCandidates(candidates: SourceCandidate[], topic: TopicDefinition): SourceCandidate[] {
    const selected: SourceCandidate[] = [];
    const selectedHashes = new Set<string>();
    const add = (candidate: SourceCandidate | undefined): void => {
        if (!candidate) return;
        const candidateHash = candidate.content_hash || candidate.source_quote;
        if (selectedHashes.has(candidateHash)) return;
        selected.push(candidate);
        selectedHashes.add(candidateHash);
    };

    for (const standard of topic.standards) {
        candidates
            .filter((candidate) => candidate.page === `KGA ${standard}`)
            .slice(0, 2)
            .forEach(add);
    }
    for (const keyword of topic.keywords) {
        candidates
            .filter((candidate) => candidate.source_quote.includes(keyword))
            .slice(0, 2)
            .forEach(add);
    }
    candidates.forEach(add);

    return selected
        .slice(0, 14)
        .map((candidate, index) => ({ ...candidate, id: `src${index + 1}` }));
}

function collectSourceBundle(topic: TopicDefinition): SourceCandidate[] {
    const candidates: SourceCandidate[] = [];
    const seen = new Set<string>();

    for (const absoluteFile of standardFiles()) {
        const relativeFile = path.relative(ROOT, absoluteFile).replaceAll('\\', '/');
        const lines = fs.readFileSync(absoluteFile, 'utf8').split(/\r?\n/);
        let currentStandard: string | null = null;

        for (const rawLine of lines) {
            currentStandard = currentStandardFromHeading(rawLine, currentStandard);
            const quote = normalize(rawLine);
            if (
                quote.length < 35
                || quote.length > 900
                || quote.startsWith('#')
                || quote.includes('](#')
                || /^- 감사기준서 \d{3,4}.+문단/u.test(quote)
            ) continue;

            const matchingKeywords = topic.keywords.filter((keyword) => quote.includes(keyword));
            if (matchingKeywords.length === 0) continue;

            const key = normalize(quote.replace(/^[-*]\s*/, ''));
            if (seen.has(key)) continue;
            seen.add(key);

            const preferredStandard = currentStandard !== null && topic.standards.includes(currentStandard);
            const score = matchingKeywords.length * 10 + (preferredStandard ? 20 : 0) + Math.min(quote.length / 100, 5);
            candidates.push({
                id: '',
                file: relativeFile,
                title: path.basename(absoluteFile, '.md'),
                ...(currentStandard ? { page: `KGA ${currentStandard}` } : {}),
                source_quote: quote,
                role: 'standard',
                content_hash: hash(quote),
                score,
            });
        }
    }

    const ranked = candidates.sort((a, b) => b.score - a.score);
    const inScope = ranked.filter((candidate) => (
        topic.standards.some((standard) => candidate.page === `KGA ${standard}`)
    ));
    return selectDiverseCandidates(inScope, topic);
}

function collectPracticeSourceBundle(topic: TopicDefinition): SourceCandidate[] {
    const candidates: SourceCandidate[] = [];
    const seen = new Set<string>();

    for (const fileName of fs.readdirSync(BASIC_THEORY_DIR).filter((name) => name.endsWith('.md'))) {
        const absoluteFile = path.join(BASIC_THEORY_DIR, fileName);
        const relativeFile = path.relative(ROOT, absoluteFile).replaceAll('\\', '/');
        let currentPage: string | undefined;
        for (const rawLine of fs.readFileSync(absoluteFile, 'utf8').split(/\r?\n/)) {
            const pageMatch = rawLine.match(/^## 원문 페이지\s+(.+)$/u);
            if (pageMatch) currentPage = `원문 페이지 ${pageMatch[1].trim()}`;

            const quote = normalize(rawLine);
            if (quote.length < 35 || quote.length > 900 || quote.startsWith('#') || /-{8,}/u.test(quote)) continue;
            const matchingKeywords = topic.keywords.filter((keyword) => quote.includes(keyword));
            if (matchingKeywords.length === 0) continue;
            const key = normalize(quote.replace(/^[-*]\s*/, ''));
            if (seen.has(key)) continue;
            seen.add(key);

            candidates.push({
                id: '',
                file: relativeFile,
                title: path.basename(absoluteFile, '.md'),
                ...(currentPage ? { page: currentPage } : {}),
                source_quote: quote,
                role: 'practice',
                content_hash: hash(quote),
                score: matchingKeywords.length * 10 + Math.min(quote.length / 100, 5),
            });
        }
    }

    return selectDiverseCandidates(candidates.sort((a, b) => b.score - a.score), topic);
}

function readWikiContext(topic: TopicDefinition): string {
    const conceptPath = path.join(WIKI_CONCEPT_DIR, `${topic.slug}.md`);
    if (!fs.existsSync(conceptPath)) {
        throw new Error(`LLM 위키 concept 페이지가 없습니다: ${conceptPath}`);
    }
    const content = fs.readFileSync(conceptPath, 'utf8');
    const seedHeading = content.indexOf('## 기존 문제 seed');
    const context = seedHeading >= 0 ? content.slice(0, seedHeading) : content;
    return context.replace(/^---[\s\S]*?---\s*/u, '').trim();
}

function extractJson(text: string): unknown {
    const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    try {
        return JSON.parse(trimmed);
    } catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start < 0 || end <= start) throw new Error('LLM 응답에서 JSON 객체를 찾을 수 없습니다.');
        return JSON.parse(trimmed.slice(start, end + 1));
    }
}

function buildPrompt(topic: TopicDefinition, sources: SourceCandidate[], previousErrors: string[]): string {
    const sourceJson = sources.map(toSourceRef);
    const wikiContext = readWikiContext(topic);
    return [
        '당신은 KICPA 회계감사 2차 시험용 문제 저자다.',
        '아래 SOURCE_BUNDLE만 근거로, 기존 문제를 복제하지 않은 새 linked question set 1개를 작성하라.',
        '',
        '[절대 규칙]',
        '- SOURCE_BUNDLE 밖의 기준, 수치, 기한, 주체, 결론을 만들지 않는다.',
        '- 계산 문제를 만들지 않는다.',
        '- shared_context의 사실은 채점 criterion으로 반복하지 않는다.',
        '- 2~3개의 서로 연계된 subquestion을 만든다.',
        '- 유형은 descriptive, enumeration, judgment만 사용한다.',
        '- 각 requirement는 SOURCE_BUNDLE의 source_ref_id 하나를 가리키고 source_quote를 글자 그대로 복사한다.',
        '- 각 criterion은 requirement_id 하나에 연결하고 독립적으로 채점 가능한 최소 명제로 작성한다.',
        '- criterion은 원칙적으로 1점이다. 정말 부분 충족이 가능한 단일 복합 명제만 2점(met 2, partial 1)으로 둔다.',
        '- 1점 criterion에는 partial 필드를 넣지 않는다.',
        '- AI가 점수를 직접 정하지 않도록 점수표는 met/partial/not_met/contradicted의 정수값만 기록한다.',
        '- model_answer는 해당 물음에 직접 답하는 문장만 포함한다.',
        '- source_refs에는 실제 사용한 SOURCE_BUNDLE 항목만 원문 그대로 복사한다.',
        '- status와 review_status는 검수 대기로 둔다.',
        '',
        `[주제] ${topic.id} ${topic.title}`,
        `[분류] ${JSON.stringify({ part: topic.part, chapter: topic.chapter, domain: topic.domain, standards: topic.standards.map((code) => `KGA ${code}`), tags: topic.keywords }, null, 2)}`,
        '',
        '[LLM_WIKI_CONTEXT — 범위·문제유형 설계용이며 정답 근거로 사용하지 말 것]',
        wikiContext,
        '',
        '[SOURCE_BUNDLE]',
        JSON.stringify(sourceJson, null, 2),
        ...(previousErrors.length > 0 ? ['', '[이전 결과의 검증 오류 — 모두 수정할 것]', ...previousErrors] : []),
        '',
        '[출력]',
        '마크다운 없이 JSON 객체 하나만 반환하라. 다음 필드를 포함하라:',
        'schema_version, id, type, status, title, classification, source_refs, shared_context, learning_order, subquestions, verification.',
        `id는 pilot-${topic.id}-001로 한다. classification.topic_id는 ${topic.id}로 한다.`,
        'verification은 source_fidelity=exact, review_status=needs_human_review, calculation_required=false로 한다.',
    ].join('\n');
}

function enforceTrustedMetadata(
    raw: unknown,
    topic: TopicDefinition,
    sourceBundle: SourceCandidate[],
): QuestionSetV3 {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('생성 결과가 객체가 아닙니다.');
    }

    const draft = structuredClone(raw) as Record<string, unknown>;
    const allowedSources = new Map(sourceBundle.map((source) => [source.id, source]));
    const requestedSources = Array.isArray(draft.source_refs) ? draft.source_refs : [];
    const sourceIds = requestedSources
        .map((source) => (typeof source === 'object' && source !== null ? String((source as Record<string, unknown>).id || '') : ''))
        .filter((id) => allowedSources.has(id));
    const uniqueSourceIds = [...new Set(sourceIds)];
    if (uniqueSourceIds.length === 0) throw new Error('생성 결과가 SOURCE_BUNDLE을 참조하지 않았습니다.');

    const trustedSources = uniqueSourceIds.map((id) => toSourceRef(allowedSources.get(id)!));
    const usedStandards = [...new Set(
        trustedSources
            .map((source) => source.page)
            .filter((page): page is string => Boolean(page?.startsWith('KGA '))),
    )];

    draft.schema_version = '3.0';
    draft.id = `pilot-${topic.id}-001`;
    draft.type = 'linked_question_set';
    draft.status = 'needs_review';
    draft.classification = {
        topic_id: topic.id,
        part: topic.part,
        chapter: topic.chapter,
        domain: topic.domain,
        standards: usedStandards,
        tags: topic.keywords,
    };
    draft.source_refs = trustedSources;
    draft.verification = {
        source_fidelity: 'exact',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: ['LLM 위키 기반 자동 생성 파일럿. 공개 전 사람 검수가 필요함.'],
    };

    const trustedById = new Map(trustedSources.map((source) => [source.id, source]));
    if (Array.isArray(draft.subquestions)) {
        for (const rawSubquestion of draft.subquestions) {
            if (typeof rawSubquestion !== 'object' || rawSubquestion === null) continue;
            const subquestion = rawSubquestion as Record<string, unknown>;
            if (!Array.isArray(subquestion.requirements)) continue;
            const requirementSources = new Map<string, string>();
            for (const rawRequirement of subquestion.requirements) {
                if (typeof rawRequirement !== 'object' || rawRequirement === null) continue;
                const requirement = rawRequirement as Record<string, unknown>;
                const sourceId = String(requirement.source_ref_id || '');
                const trustedSource = trustedById.get(sourceId);
                if (trustedSource) {
                    requirement.source_quote = trustedSource.source_quote;
                    requirementSources.set(String(requirement.id || ''), sourceId);
                }
            }
            if (Array.isArray(subquestion.criteria)) {
                for (const rawCriterion of subquestion.criteria) {
                    if (typeof rawCriterion !== 'object' || rawCriterion === null) continue;
                    const criterion = rawCriterion as Record<string, unknown>;
                    const requirementSourceId = requirementSources.get(String(criterion.requirement_id || ''));
                    const requestedCriterionSources = Array.isArray(criterion.source_ref_ids)
                        ? criterion.source_ref_ids.map(String).filter((sourceId) => trustedById.has(sourceId))
                        : [];
                    criterion.source_ref_ids = [
                        ...new Set([
                            ...(requirementSourceId ? [requirementSourceId] : []),
                            ...requestedCriterionSources,
                        ]),
                    ];
                }
            }
        }
    }

    return draft as unknown as QuestionSetV3;
}

async function generateTopic(ai: GoogleGenAI, topic: TopicDefinition): Promise<QuestionSetV3> {
    const sourceBundle = topic.standards.length > 0
        ? collectSourceBundle(topic)
        : collectPracticeSourceBundle(topic);
    if (sourceBundle.length < 2) {
        throw new Error(`${topic.id} ${topic.title}: 출처 후보가 ${sourceBundle.length}개뿐입니다.`);
    }

    let previousErrors: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
        let responseText = '';
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: buildPrompt(topic, sourceBundle, previousErrors),
                config: {
                    responseMimeType: 'application/json',
                    responseJsonSchema: QUESTION_SET_RESPONSE_SCHEMA,
                    temperature: 0.2,
                },
            });
            responseText = response.text || '';
            const draft = enforceTrustedMetadata(extractJson(responseText), topic, sourceBundle);
            const validation = validateQuestionSetV3(draft, { verifySourceQuotes: true, cwd: ROOT });
            if (validation.errors.length === 0) {
                console.log(`[${topic.id}/19] ${topic.title}: 생성 완료 (${validation.max_points}점)`);
                return draft;
            }
            previousErrors = validation.errors.slice(0, 20);
            console.warn(`[${topic.id}/19] 검증 실패 ${attempt}/3: ${previousErrors.join(' | ')}`);
        } catch (error) {
            previousErrors = [error instanceof Error ? error.message : String(error)];
            if (process.env.CPA_V3_DEBUG === '1' && responseText) {
                fs.writeFileSync(
                    path.join(OUTPUT_DIR, `.debug-v3-${topic.id}-${attempt}.txt`),
                    responseText,
                    'utf8',
                );
                if (error instanceof Error && error.stack) console.warn(error.stack);
            }
            console.warn(`[${topic.id}/19] 생성 실패 ${attempt}/3: ${previousErrors[0]}`);
            if (attempt < 3) {
                await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
            }
        }
    }
    throw new Error(`${topic.id} ${topic.title}: 3회 생성 후에도 검증을 통과하지 못했습니다.`);
}

async function main(): Promise<void> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY가 필요합니다. --env-file=.env.local로 실행하세요.');

    const ai = new GoogleGenAI({ apiKey });
    const selectedTopic = process.env.CPA_V3_TOPIC;
    const topics = selectedTopic ? TOPICS.filter((topic) => topic.id === selectedTopic) : TOPICS;
    if (topics.length === 0) throw new Error(`알 수 없는 CPA_V3_TOPIC: ${selectedTopic}`);

    const sets: QuestionSetV3[] = !selectedTopic
        && process.env.CPA_V3_FRESH !== '1'
        && fs.existsSync(CHECKPOINT_PATH)
        ? JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8')) as QuestionSetV3[]
        : [];
    for (const topic of topics) {
        if (sets.some((set) => set.classification.topic_id === topic.id)) {
            console.log(`[${topic.id}/19] ${topic.title}: 체크포인트에서 복원`);
            continue;
        }
        sets.push(await generateTopic(ai, topic));
        if (!selectedTopic) {
            sets.sort((left, right) => left.classification.topic_id.localeCompare(right.classification.topic_id));
            fs.writeFileSync(CHECKPOINT_PATH, `${JSON.stringify(sets, null, 2)}\n`, 'utf8');
        }
    }

    if (selectedTopic) {
        console.log(`진단 실행 완료: ${selectedTopic}`);
        return;
    }

    fs.writeFileSync(AUTHORING_PATH, `${JSON.stringify(sets, null, 2)}\n`, 'utf8');
    fs.writeFileSync(PUBLIC_PATH, `${JSON.stringify(sets.map(compilePublicQuestionSet), null, 2)}\n`, 'utf8');
    if (fs.existsSync(CHECKPOINT_PATH)) fs.unlinkSync(CHECKPOINT_PATH);
    console.log(`v3 파일럿 ${sets.length}세트를 기록했습니다.`);
    console.log(path.relative(ROOT, AUTHORING_PATH));
    console.log(path.relative(ROOT, PUBLIC_PATH));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
