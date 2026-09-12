import { CheckCircle2, CircleMinus, CircleAlert, ChevronDown, Quote } from 'lucide-react';
import type { ReactNode } from 'react';
import type { QuestionSetGradeResultV3 } from '../lib/questionV3Grading';

export function GradeResultDetails({ result, subquestionAction, questionOffset = 0, embedded = false }: {
  result: QuestionSetGradeResultV3;
  subquestionAction?: (subquestionId: string) => ReactNode;
  questionOffset?: number;
  embedded?: boolean;
}) {
  return result.subquestions.map((subquestion, index) => {
    const unmet = subquestion.criteria.filter(item => item.awarded_points < item.max_points).length;
    return <section key={subquestion.subquestion_id} className={embedded ? 'p-5 sm:p-7' : 'panel p-5 sm:p-7'}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base">물음 {index + questionOffset + 1} · 채점 결과</h2><span className="text-lg font-semibold tabular-nums">{subquestion.score}<span className="ml-1 text-sm font-normal text-muted">/ {subquestion.max_points}점</span></span></div>
      {!embedded && <><p className="mt-4 whitespace-pre-wrap break-words text-base leading-8">{subquestion.prompt}</p><div className="mt-5 rounded-control border border-card-border bg-background p-4"><h3 className="text-xs text-muted">내 답안</h3><p className="mt-2 whitespace-pre-wrap break-words text-base leading-8">{subquestion.user_answer || '(미작성)'}</p></div></>}
      <p className={`mt-5 rounded-control px-4 py-3 text-sm leading-7 ${unmet ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>{unmet ? `보완할 기준이 ${unmet}개 있습니다. 기준과 내 답안을 비교해 보세요.` : '모든 채점기준에서 만점을 받았습니다.'}</p>
      <div className="mt-6"><h3 className="text-xs font-medium text-muted">채점기준과 답안 근거</h3><ul className="mt-3 divide-y divide-card-border">
        {subquestion.criteria.map(criterion => {
          const label = criterion.verdict === 'contradicted' ? '반대 내용' : criterion.verdict === 'partial' ? '부분 충족' : criterion.verdict === 'met' ? '충족' : '미충족';
          const Icon = criterion.verdict === 'met' ? CheckCircle2 : criterion.verdict === 'contradicted' ? CircleAlert : CircleMinus;
          const color = criterion.verdict === 'met' ? 'text-success' : criterion.verdict === 'contradicted' ? 'text-danger' : 'text-warning';
          return <li key={criterion.criterion_id} className="flex items-start gap-3 py-4"><Icon aria-hidden="true" className={`mt-1 size-4 shrink-0 ${color}`} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><span className={`text-xs font-medium ${color}`}>{label}</span><span className="shrink-0 text-xs tabular-nums text-muted">{criterion.awarded_points}/{criterion.max_points}점</span></div><p className="mt-2 break-words text-sm leading-7">{criterion.claim}</p>{criterion.quote && <blockquote className="mt-3 border-l-2 border-card-border pl-3 text-sm leading-7 text-muted"><span className="mb-1 flex items-center gap-1 text-xs"><Quote aria-hidden="true" className="size-3" />내 답안 근거</span><span className="whitespace-pre-wrap break-words">{criterion.quote}</span></blockquote>}</div></li>;
        })}
      </ul></div>
      <details className="mt-4 rounded-control border border-card-border bg-background p-4"><summary className="flex min-h-8 list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">모범답안 보기<ChevronDown className="size-4 text-muted" aria-hidden="true" /></summary><ul className="mt-4 space-y-3 border-t border-card-border pt-4">{subquestion.model_answer.map((answer, answerIndex) => <li key={answerIndex} className="whitespace-pre-wrap break-words text-base leading-8">{answer}</li>)}</ul></details>
      {subquestionAction && <div className="mt-5">{subquestionAction(subquestion.subquestion_id)}</div>}
    </section>;
  });
}
