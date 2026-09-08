import { CheckCircle2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { QuestionSetGradeResultV3 } from '../lib/questionV3Grading';

export function GradeResultDetails({ result, subquestionAction }: {
    result: QuestionSetGradeResultV3;
    subquestionAction?: (subquestionId: string) => ReactNode;
}) {
    return result.subquestions.map((subquestion, index) => (
        <section key={subquestion.subquestion_id} className="rounded-lg border border-card-border bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium">물음 {index + 1}</h2>
                <span className="text-sm">{subquestion.score} / {subquestion.max_points}점</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/85">{subquestion.prompt}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-card-border bg-card-border/15 p-4">
                    <h3 className="text-xs font-medium text-foreground/45">내 답안</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{subquestion.user_answer || '(미작성)'}</p>
                </div>
                <div className="rounded-md border border-success/25 bg-success/5 p-4">
                    <h3 className="text-xs font-medium text-success">모범답안</h3>
                    <ul className="mt-2 space-y-2 text-sm leading-6">
                        {subquestion.model_answer.map((answer) => <li key={answer}>· {answer}</li>)}
                    </ul>
                </div>
            </div>
            <div className="mt-5 space-y-2">
                <h3 className="text-xs font-medium tracking-wider text-foreground/45">채점기준 판정</h3>
                {subquestion.criteria.map((criterion) => (
                    <div key={criterion.criterion_id} className="flex items-start gap-3 rounded-md border border-card-border p-3">
                        {criterion.awarded_points > 0
                            ? <CheckCircle2 aria-label="득점" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                            : <XCircle aria-label="감점" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm leading-6">{criterion.claim}</p>
                            {criterion.quote && <p className="mt-1 text-xs text-foreground/45">답안 근거: “{criterion.quote}”</p>}
                        </div>
                        <span className="shrink-0 text-xs text-foreground/55">{criterion.awarded_points}/{criterion.max_points}</span>
                    </div>
                ))}
            </div>
            {subquestionAction && <div className="mt-4">{subquestionAction(subquestion.subquestion_id)}</div>}
        </section>
    ));
}
