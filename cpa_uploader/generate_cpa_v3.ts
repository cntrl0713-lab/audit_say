import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
    validateQuestionSetV3,
} from '../lib/questionV3.ts';
import { requestOpenAIStructured } from '../lib/ai/openaiStructured.ts';
import type { OpenAIResponseCreator } from '../lib/ai/openaiStructured.ts';
import { allocateQuestionSetId, draftConflicts, readPendingDrafts, readQuestionBank } from './questionDraftInventory.ts';
import { buildSourceCatalog, createSourcePacket } from './questionSourceCatalog.mjs';
import { authoringPlanHash, createQuestionAuthoringPlan, readQuestionAuthoringPlans, validateQuestionAuthoringPlan } from './questionAuthoringPlan.ts';
import type { QuestionAuthoringPlan } from './questionAuthoringPlan.ts';
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

interface SourceCandidate extends SourceRefV3 { source_span: string; }

type SourcePacket = ReturnType<typeof createSourcePacket>;

interface GenerationCheckpoint {
    schema_version: '3.0';
    model: string;
    source_fingerprint: string;
    plan_hashes: string[];
    sets: QuestionSetV3[];
}

const ROOT = process.cwd();
const WIKI_CONCEPT_DIR = path.join(ROOT, 'cpa_uploader/wiki/concepts');
const WIKI_GUIDE_FILES = [
    'question-design.md',
    'question-output-schema.md',
    'llm-question-generation-prompt.md',
    'question-generation-workflow.md',
    'source-authoring-design.md',
] as const;
const GENERATION_PROMPT_CONTRACT_VERSION = 'source-plan-context-strict-evidence-2026-09-09';
const OUTPUT_DIR = path.join(ROOT, 'cpa_uploader/data');
const DEFAULT_DRAFT_PATH = path.join(OUTPUT_DIR, 'cpa_question_sets_v3.generated.draft.json');

function parseArgs(argv: string[]): Record<string, string> {
    const args: Record<string, string> = {};
    for (let index = 0; index < argv.length; index++) {
        const [key, inline] = argv[index].split(/=([\s\S]*)/u);
        if (key === '--list-sources') { args[key] = '1'; continue; }
        if (!['--output', '--plan', '--prepare-plan', '--topic', '--source', '--mode'].includes(key)) throw new Error(`지원하지 않는 옵션: ${key}`);
        const value = inline ?? argv[++index];
        if (!value || value.startsWith('--')) throw new Error(`${key} 값이 필요합니다.`);
        args[key] = key === '--source' && args[key] ? args[key] + ',' + value : value;
    }
    return args;
}

function generationModel(): string {
    return process.env.CPA_GENERATION_MODEL || 'gpt-5.6-luna';
}

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
                required: ['id', 'file', 'title', 'page', 'source_quote', 'role', 'content_hash'],
                properties: {
                    id: { type: 'string' },
                    file: { type: 'string' },
                    title: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    page: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                    source_quote: { type: 'string' },
                    role: { type: 'string' },
                    content_hash: { anyOf: [{ type: 'string' }, { type: 'null' }] },
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
            minItems: 1,
            maxItems: 4,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'type', 'question_style', 'topic_ids', 'prompt', 'constraints', 'selection', 'model_answer', 'requirements', 'criteria'],
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['descriptive', 'enumeration', 'judgment'] },
                    question_style: { type: 'string', enum: ['case', 'standard'] },
                    topic_ids: { type: 'array', minItems: 1, items: { type: 'string', enum: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'] } },
                    prompt: { type: 'string' },
                    constraints: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['ordered', 'max_entries', 'overflow_policy'],
                        properties: {
                            ordered: { type: 'boolean', enum: [false] },
                            max_entries: { type: 'null' },
                            overflow_policy: { type: 'string', enum: ['none'] },
                        },
                    },
                    selection: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['type', 'n'],
                        properties: {
                            type: { type: 'string', enum: ['all'] },
                            n: { type: 'null' },
                        },
                    },
                    model_answer: { type: 'array', minItems: 1, items: { type: 'string' } },
                    requirements: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                                required: ['id', 'source_ref_id', 'source_quote', 'source_span'],
                                properties: {
                                    id: { type: 'string' },
                                    source_ref_id: { type: 'string' },
                                    source_quote: { type: 'string' },
                                    source_span: { anyOf: [{ type: 'string' }, { type: 'null' }] },
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
                                    required: ['met', 'partial', 'not_met', 'contradicted'],
                                    properties: {
                                        met: { type: 'integer' },
                                        partial: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
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

function hash(value: string): string {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function sourceFingerprint(root = ROOT): string {
    const wiki = path.join(root, 'cpa_uploader/wiki');
    const markdown = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? markdown(file) : entry.name.endsWith('.md') ? [file] : [];
    });
    const files = [
        ...markdown(path.join(wiki, 'concepts')),
        ...markdown(path.join(wiki, 'question-generation')),
        'cpa_uploader/generate_cpa_v3.ts', 'cpa_uploader/questionAuthoringPlan.ts',
        'cpa_uploader/questionSourceCatalog.mjs', 'cpa_uploader/questionDraftInventory.ts',
        'lib/questionV3.ts', 'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
    ].map(file => path.isAbsolute(file) ? file : path.join(root, file)).sort();
    return hash(JSON.stringify({ version: GENERATION_PROMPT_CONTRACT_VERSION, catalog: buildSourceCatalog({ repoDir: root }).fingerprint, schema: QUESTION_SET_RESPONSE_SCHEMA })
        + files.map(file => path.relative(root, file) + '\n' + fs.readFileSync(file, 'utf8')).join('\n'));
}

function toSourceRef(candidate: SourceCandidate): SourceRefV3 {
    const { source_span: _locator, ...reference } = candidate;
    void _locator;
    return reference;
}

export function prepareGenerationPacket(plan: QuestionAuthoringPlan): SourcePacket {
    const errors = validateQuestionAuthoringPlan(plan);
    if (errors.length) throw new Error(errors.join('\n'));
    const packet = createSourcePacket({ repoDir: ROOT, topicId: plan.topic_id, sourceIds: plan.source_unit_ids });
    if (packet.completeness !== 'complete' || packet.unresolved.length) throw new Error('출처 문맥이 미완성입니다: ' + JSON.stringify(packet.unresolved));
    const primaries = Array.isArray(packet.primary) ? packet.primary : [packet.primary];
    if (plan.mode === 'new_from_standard' && !primaries.some(unit => unit.kind === 'standard')) throw new Error('기준서 신규 제작에는 standard 원문 단위를 선택하십시오.');
    if (plan.mode === 'adapt_existing_question' && !primaries.some(unit => ['practice', 'past_exam'].includes(unit.kind))) throw new Error('기존 문제 재구성에는 practice 또는 past_exam 원문 단위를 선택하십시오.');
    return packet;
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

function readWikiGuides(topicId: string): string {
    return [...WIKI_GUIDE_FILES, `topics/topic-${topicId}-design.md`].map((name) => {
        const file = path.join(ROOT, 'cpa_uploader/wiki/question-generation', name);
        // Keep the authored rules, but omit frontmatter, navigation, and illustrative
        // JSON/template input placeholders that are already supplied by this request.
        const content = fs.readFileSync(file, 'utf8')
            .replace(/^---[\s\S]*?---\s*/u, '')
            .replace(/\n## Related\s*\n[\s\S]*$/u, '')
            .replace(/```json\s*\n[\s\S]*?```/gu, '[구조 예시는 생략. 실제 응답 형상은 요청의 JSON Schema를 따른다.]')
            .replace(/\n\[CONCEPT PAGE\]\n[\s\S]*?\n```/u, '\n```');
        return `[WIKI_GUIDE: ${name}]\n${content.trim()}`;
    }).join('\n\n');
}

function buildPrompt(topic: TopicDefinition, packet: SourcePacket, plan: QuestionAuthoringPlan, setId: string): string {
    const sources: SourceCandidate[] = packet.sourceRefs;
    const sourceJson = sources.map(toSourceRef);
    const wikiContext = readWikiContext(topic);
    return [
        '당신은 KICPA 회계감사 2차 시험용 문제 저자다.',
        '아래 SOURCE_BUNDLE만 근거로, 기존 문제를 복제하지 않은 새 linked question set 1개를 작성하라.',
        '',
        `[출제 계약 ${GENERATION_PROMPT_CONTRACT_VERSION}]`,
        '- 응답 JSON Schema의 필드 형상·허용값과 아래 실행 계약을 지킨다. WIKI_GUIDE는 설계·검수 규칙이며 그중 현재 주제에 해당하는 지침을 적용한다.',
        '- 정답의 사실 근거는 SOURCE_BUNDLE뿐이다. WIKI_GUIDE의 예시·주제별 설명, concept의 기존 정답, 문서 링크를 직접 출처로 사용하지 않는다.',
        '- 문서가 요구하는 사람 검수·공식 판본 확인을 자동 완료했다고 기록하지 않는다. 제공 자료로 확인하지 못하는 사항은 verification.notes에 남긴다.',
        '- 문서의 수동 입력 자리표시자 대신 이 요청의 concept와 SOURCE_BUNDLE을 사용한다. 제공되지 않은 문제·해설 원문은 만들어 넣지 않는다.',
        '- SOURCE_BUNDLE 밖의 기준, 수치, 기한, 주체, 결론을 만들지 않는다.',
        '- subquestion마다 question_style(case 또는 standard)과 실제 요구에 대응하는 topic_ids(하나 이상)를 기록한다. type(descriptive/enumeration/judgment)은 답안 형식이며 학습 유형과 별개다.',
        '- 사실관계와 연계해 답해야 하면 case, 기준서만 보고 답할 수 있으면 standard다. 한 출력에는 같은 학습 유형만 담는다. case는 사실관계를 가진 부모 문제 아래 1~4개 물음으로 구성하며 서로 다른 주제를 섞을 수 있다.',
        '- standard는 공통 사실관계를 빈 배열로 두고 각 물음만으로 풀 수 있게 쓴다. 한 물음만 제작할 수 있으며 별도의 부모 사례나 다른 물음 답안을 요구하지 않는다. 독립된 답안 범위가 과도하게 묶이면 별도 물음으로 분리한다.',
        "- 모든 물음은 selection={type:'all',n:null}, constraints={ordered:false,max_entries:null,overflow_policy:'none'}이다. 답안 전체에서 충족한 독립 criterion을 정수 합산하며 의미상의 절차 순서·시점은 보존한다.",
        '- 각 requirement는 SOURCE_BUNDLE의 source_ref_id 하나를 가리키고 source_quote를 글자 그대로 복사한다. source_span은 SOURCE_LOCATORS의 해당 ID 값과 정확히 같아야 한다.',
        '- 주어진 AUTHORING_PLAN의 학습목표·조건·예외·답안범위·물음유형을 지킨다. 기존 문제 재구성에서는 선택한 원문의 실제 발문/해설을 구별한다.',
        '- SOURCE_CONTEXT의 연결 문단·하위 목록·예외를 함께 확인한다. 원문이 부족하거나 계산이 필요하면 해당 사실을 notes와 verification에 남긴다. 코드가 이를 적합으로 바꿔주지 않는다.',
        '- 1점 criterion은 응답 스키마의 필수 nullable partial을 null로 반환한다. 저장 전 null 필드를 제거하며 소수 부분점수는 허용하지 않는다.',
        '- source_refs에는 실제 사용한 SOURCE_BUNDLE 항목만 원문 그대로 복사한다.',
        '',
        readWikiGuides(topic.id),
        '',
        `[주제] ${topic.id} ${topic.title}`,
        `[분류] ${JSON.stringify({ part: topic.part, chapter: topic.chapter, domain: topic.domain, standards: topic.standards.map((code) => `KGA ${code}`), tags: topic.keywords }, null, 2)}`,
        '',
        '[LLM_WIKI_CONTEXT — 범위·문제유형 설계용이며 정답 근거로 사용하지 말 것]',
        wikiContext,
        '',
        '[AUTHORING_PLAN — 사람이 지정한 출제 목표와 범위]',
        JSON.stringify(plan, null, 2),
        '[SOURCE_CONTEXT — 근거 단위·의존 문맥·판본, 최종 시험 판본 승인 아님]',
        JSON.stringify({ units: packet.units.map(unit => ({ id: unit.id, file: unit.file, locator: unit.locator, authority: unit.authority, edition: unit.edition, provenance: unit.provenance })), warnings: packet.warnings }, null, 2),
        '[SOURCE_LOCATORS]',
        JSON.stringify(Object.fromEntries(sources.map(source => [source.id, source.source_span])), null, 2),
        '',
        '[SOURCE_BUNDLE]',
        JSON.stringify(sourceJson, null, 2),
        '',
        '[출력]',
        '마크다운 없이 JSON 객체 하나만 반환하라. 다음 필드를 포함하라:',
        'schema_version, id, type, status, title, classification, source_refs, shared_context, learning_order, subquestions, verification.',
        `id는 ${setId}로 한다. classification.topic_id는 ${topic.id}로 한다.`,
        '정확한 인용과 계산 없는 출제가 가능할 때만 source_fidelity=exact, calculation_required=false를 사용한다. 충족할 수 없다면 실제 상태를 기록하며 해당 응답은 출제로 채택되지 않는다. review_status=needs_human_review이다.',
    ].join('\n');
}

// Bind evidence by comparison. Never turn an unsupported response into an apparently
// grounded one by replacing its quotes, locations, fidelity, or calculation flag.
export function enforceTrustedMetadata(raw: unknown, topicId: string, sourceBundle: SourceCandidate[], setId: string, plan: QuestionAuthoringPlan): QuestionSetV3 {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('생성 결과가 객체가 아닙니다.');
    const draft = structuredClone(raw) as QuestionSetV3;
    if (draft.id !== setId || draft.classification?.topic_id !== topicId) throw new Error('지정된 세트 ID와 주제를 그대로 사용해야 합니다.');
    if (draft.status !== 'needs_review' || draft.verification?.review_status !== 'needs_human_review') throw new Error('생성 초안은 검수 대기 상태여야 합니다.');
    if (draft.verification.source_fidelity !== 'exact' || draft.verification.calculation_required !== false) throw new Error('인용 충실성 또는 계산 필요 신호를 재검토하십시오. 원래 상태를 자동 보정하지 않습니다.');
    if (!Array.isArray(draft.verification.notes) || draft.verification.notes.some(note => typeof note !== 'string')) throw new Error('verification.notes는 문자열 배열이어야 합니다.');
    if (!Array.isArray(draft.source_refs) || !draft.source_refs.length) throw new Error('SOURCE_BUNDLE의 직접 근거가 필요합니다.');
    const allowed = new Map(sourceBundle.map(source => [source.id, source]));
    const used = new Map<string, SourceCandidate>();
    for (const source of draft.source_refs) {
        const expected = allowed.get(source.id);
        if (!expected || used.has(source.id)) throw new Error('허용되지 않거나 중복된 source ID: ' + source.id);
        for (const key of ['file', 'title', 'page', 'source_quote', 'role', 'content_hash'] as const) {
            if ((source[key] ?? null) !== (expected[key] ?? null)) throw new Error(source.id + ': SOURCE_BUNDLE과 ' + key + '가 다릅니다.');
        }
        used.set(source.id, expected);
    }
    const standards = [...new Set(draft.source_refs.map(source => source.page).filter((page): page is string => !!page?.startsWith('KGA ')))].sort();
    if (JSON.stringify([...draft.classification.standards].sort()) !== JSON.stringify(standards)) throw new Error('classification.standards는 사용한 직접 KGA 출처와 일치해야 합니다.');
    for (const q of draft.subquestions ?? []) {
        if (!['case', 'standard'].includes(q.question_style ?? '') || !Array.isArray(q.topic_ids) || q.topic_ids.length === 0) {
            throw new Error(q.id + ': 신규 물음의 학습 유형·주제가 필요합니다.');
        }
        if (!plan.question_types.includes(q.type)) throw new Error(q.id + ': 계획에서 선택하지 않은 물음 유형입니다.');
        const requirements = new Map((q.requirements ?? []).map(req => [req.id, req]));
        for (const req of q.requirements ?? []) {
            const source = used.get(req.source_ref_id);
            if (!source || req.source_quote !== source.source_quote) throw new Error(req.id + ': requirement 인용이 지정 원문과 다릅니다.');
            if (req.source_span !== source.source_span) throw new Error(req.id + ': source_span이 검증된 문단·파일 위치와 다릅니다.');
        }
        for (const criterion of q.criteria ?? []) {
            const req = requirements.get(criterion.requirement_id);
            if (!req || !Array.isArray(criterion.source_ref_ids) || !criterion.source_ref_ids.includes(req.source_ref_id) || criterion.source_ref_ids.some(id => !used.has(id))) throw new Error(criterion.id + ': criterion의 출처 연결이 잘못되었습니다.');
            // A nullable schema slot is a transport representation, not a review signal.
            if (criterion.scores?.partial === null) delete criterion.scores.partial;
        }
    }
    draft.verification.notes.push('출제 계획 해시: ' + authoringPlanHash(plan), '생성·인용 검증은 의미 검수 완료를 뜻하지 않음. 독립 의미 검수와 사람 검토 근거가 필요함.', '적용 판본·시험 가정: ' + plan.edition_assumption);
    return draft;
}

export async function generateTopic(topicId: string, createResponse: OpenAIResponseCreator | undefined, existingDrafts: QuestionSetV3[], plan: QuestionAuthoringPlan): Promise<QuestionSetV3> {
    const topic = TOPICS.find((candidate) => candidate.id === topicId);
    if (!topic) throw new Error(`알 수 없는 CPA_V3_TOPIC: ${topicId}`);
    const bank = readQuestionBank();
    const existing = [...bank, ...readPendingDrafts(), ...existingDrafts];
    const setId = allocateQuestionSetId(topicId, existing.map((set) => set.id));
    if (!plan || plan.topic_id !== topicId) throw new Error('현재 주제의 완성된 출제 계획이 필요합니다.');
    const packet = prepareGenerationPacket(plan);
    const sourceBundle: SourceCandidate[] = packet.sourceRefs;
    if (!sourceBundle.length) throw new Error('출제 근거가 없습니다.');
    const prompt = buildPrompt(topic, packet, plan, setId);

    let previousErrors: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const raw = await requestOpenAIStructured({
                apiKey: process.env.OPENAI_API_KEY || '',
                model: generationModel(),
                name: 'audit_question_set_generation',
                instructions: 'KICPA 회계감사 문제 출제자는 제공된 출처만 사용하고, 사람 검수 대기 상태의 v3 JSON만 작성하십시오.',
                input: [prompt, ...(previousErrors.length ? ['[이전 결과의 검증 오류 — 모두 수정할 것]', ...previousErrors] : [])].join('\n\n'),
                schema: QUESTION_SET_RESPONSE_SCHEMA as Record<string, unknown>,
                maxOutputTokens: 16_000,
                timeoutMs: 45_000,
                // 검증 재시도는 이 함수가 소유한다. 전송 계층과 중첩하지 않는다.
                maxAttempts: 1,
            }, createResponse);
            const draft = enforceTrustedMetadata(raw, topicId, sourceBundle, setId, plan);
            draft.verification.notes.push('출처 묶음 해시: ' + packet.fingerprint);
            draft.verification.notes.push(...packet.warnings.map(warning => typeof warning === 'string' ? warning : JSON.stringify(warning)));
            const validation = validateQuestionSetV3(draft, { verifySourceQuotes: true, cwd: ROOT });
            validation.errors.push(...draftConflicts([draft], [...existing, ...readQuestionBank(), ...readPendingDrafts()]));
            if (validation.errors.length === 0) {
                console.log(`[${topic.id}/19] ${topic.title}: 생성 완료 (${validation.max_points}점)`);
                return draft;
            }
            previousErrors = validation.errors.slice(0, 20);
            console.warn(`[${topic.id}/19] 검증 실패 ${attempt}/3: ${previousErrors.join(' | ')}`);
        } catch (error) {
            previousErrors = [error instanceof Error ? error.message : String(error)];
            console.warn(`[${topic.id}/19] 생성 실패 ${attempt}/3: ${previousErrors[0]}`);
            if (!createResponse && attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 2_000));
        }
    }
    throw new Error(`${topic.id} ${topic.title}: 3회 생성 후에도 검증을 통과하지 못했습니다.`);
}

export async function main(createResponse?: OpenAIResponseCreator): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const topicId = args['--topic'] || process.env.CPA_V3_TOPIC;
    if (topicId && !TOPICS.some(topic => topic.id === topicId)) throw new Error('알 수 없는 주제: ' + topicId);
    if (args['--list-sources']) {
        const catalog = buildSourceCatalog({ repoDir: ROOT });
        console.log(JSON.stringify(catalog.units.filter(unit => !topicId || unit.topicIds.includes(topicId)).map(unit => ({ id: unit.id, topics: unit.topicIds, kind: unit.kind, title: unit.title, authority: unit.authority, locator: unit.locator })), null, 2));
        return;
    }
    if (args['--prepare-plan']) {
        if (!topicId) throw new Error('--prepare-plan에는 --topic이 필요합니다.');
        const sourceIds = (args['--source'] || '').split(',').filter(Boolean);
        const packet = createSourcePacket({ repoDir: ROOT, topicId, includeSectionContext: false, ...(sourceIds.length ? { sourceIds } : {}) });
        const primary = Array.isArray(packet.primary) ? packet.primary : [packet.primary];
        const mode = args['--mode'] || 'new_from_standard';
        if (!['new_from_standard', 'adapt_existing_question'].includes(mode)) throw new Error('--mode가 올바르지 않습니다.');
        const plan = createQuestionAuthoringPlan(topicId, primary.map(unit => unit.id), mode as QuestionAuthoringPlan['mode']);
        plan.unresolved_items.push(...packet.unresolved.map(item => typeof item === 'string' ? item : JSON.stringify(item)));
        const target = path.resolve(args['--prepare-plan']);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify(plan, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
        console.log('출제 계획 초안: ' + target + '\n목표·범위·판본을 작성하고 미확인 사항을 해소한 뒤 ready로 기록하십시오.');
        return;
    }
    if (!args['--plan']) throw new Error('--plan <출제계획.json>이 필요합니다. --list-sources와 --prepare-plan으로 목표·범위를 먼저 정하십시오.');
    const plans = readQuestionAuthoringPlans(path.resolve(args['--plan'])).filter(plan => !topicId || plan.topic_id === topicId);
    if (!plans.length) throw new Error('선택한 주제의 출제 계획이 없습니다.');
    const planHashes = plans.map(authoringPlanHash);
    if (new Set(planHashes).size !== planHashes.length) throw new Error('동일한 출제 계획을 중복 실행할 수 없습니다.');
    const packets = plans.map(prepareGenerationPacket);
    const draftPath = path.resolve(ROOT, args['--output'] || process.env.CPA_V3_OUTPUT_PATH || DEFAULT_DRAFT_PATH);
    const planPath = draftPath + '.authoring-plan.json';
    const packetPath = draftPath + '.source-packet.json';
    const checkpointPath = draftPath + '.checkpoint.json';
    const protectedPaths = new Set([
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'cpa_uploader/data/cpa_question_sets_v3.public.json',
        'cpa_uploader/data/cpa_question_sets_v3.promotions.json',
        args['--plan'],
    ].map(file => path.resolve(ROOT, file).toLowerCase()));
    if (protectedPaths.has(draftPath.toLowerCase())) throw new Error('생성 출력은 정본·공개본·장부·출제 계획을 덮어쓸 수 없습니다.');
    for (const file of [draftPath, planPath, packetPath]) if (fs.existsSync(file)) throw new Error('생성 결과가 이미 존재합니다. 별도 --output 경로를 지정하세요: ' + file);
    if (!process.env.OPENAI_API_KEY && !createResponse) throw new Error('OPENAI_API_KEY가 필요합니다.');
    if (process.env.CPA_V3_FRESH === '1' && fs.existsSync(checkpointPath)) throw new Error('기존 체크포인트를 덮어쓸 수 없습니다. 새 --output 경로로 시작하세요.');
    const fingerprint = sourceFingerprint();
    const sets: QuestionSetV3[] = [];
    if (fs.existsSync(checkpointPath)) {
        const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) as GenerationCheckpoint;
        if (checkpoint.schema_version !== '3.0' || checkpoint.model !== generationModel() || checkpoint.source_fingerprint !== fingerprint
            || JSON.stringify(checkpoint.plan_hashes) !== JSON.stringify(planHashes) || !Array.isArray(checkpoint.sets) || checkpoint.sets.length > plans.length) throw new Error('체크포인트의 계획·출제 계약·원자료·모델이 현재와 다릅니다.');
        const errors = [
            ...draftConflicts(checkpoint.sets, [...readQuestionBank(), ...readPendingDrafts(ROOT, path.dirname(draftPath), [checkpointPath])]),
            ...checkpoint.sets.flatMap((set, index) => {
                const errors = validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: ROOT }).errors;
                try {
                    enforceTrustedMetadata(set, plans[index].topic_id, packets[index].sourceRefs, set.id, plans[index]);
                } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
                if (!set.verification?.notes?.includes('출제 계획 해시: ' + planHashes[index])) errors.push('체크포인트의 세트·계획 연결이 다릅니다.');
                if (!set.verification?.notes?.includes('출처 묶음 해시: ' + packets[index].fingerprint)) errors.push('체크포인트의 세트·출처 묶음 연결이 다릅니다.');
                return errors;
            }),
        ];
        if (errors.length) throw new Error('체크포인트 복원 검증 실패:\n' + errors.join('\n'));
        sets.push(...checkpoint.sets);
    }
    fs.mkdirSync(path.dirname(draftPath), { recursive: true });
    for (let index = sets.length; index < plans.length; index++) {
        sets.push(await generateTopic(plans[index].topic_id, createResponse, [...sets, ...readPendingDrafts(ROOT, path.dirname(draftPath), [checkpointPath])], plans[index]));
        const checkpoint: GenerationCheckpoint = { schema_version: '3.0', model: generationModel(), source_fingerprint: fingerprint, plan_hashes: planHashes, sets };
        fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2) + '\n');
    }
    const conflicts = draftConflicts(sets, [...readQuestionBank(), ...readPendingDrafts(ROOT, path.dirname(draftPath), [checkpointPath])]);
    if (conflicts.length) throw new Error('draft 기록 전 중복 검증 실패:\n' + conflicts.join('\n'));
    if (sourceFingerprint() !== fingerprint) throw new Error('생성 중 원자료·지침·정본이 바뀌었습니다. 현재 내용을 다시 확인하십시오.');
    const outputs = [
        { file: planPath, value: { artifact_type: 'question_authoring_plan', version: 1, plans: plans.map((plan, index) => ({ ...plan, set_id: sets[index].id })) } },
        { file: packetPath, value: { artifact_type: 'question_source_packet', version: 1, packets: packets.map((packet, index) => ({ ...packet, set_id: sets[index].id, plan_hash: planHashes[index] })) } },
        { file: draftPath, value: sets },
    ];
    const written: string[] = [];
    try {
        for (const output of outputs) { fs.writeFileSync(output.file, JSON.stringify(output.value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' }); written.push(output.file); }
    } catch (error) {
        for (const file of written) fs.unlinkSync(file);
        throw error;
    }
    fs.unlinkSync(checkpointPath);
    console.log('검수 대기 초안 ' + sets.length + '세트: ' + draftPath + '\n출제 계획·원문 문맥 sidecar를 함께 저장했습니다. 의미 검수 후 사람 검토 근거로 승급하십시오.');
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
