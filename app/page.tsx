import Link from 'next/link';
import { ArrowDown, ArrowRight, BookOpen, BriefcaseBusiness, Building2, Check, CheckCheck, FileCheck2, FileText, ListChecks, Minus, Quote, RotateCcw, ShieldCheck } from 'lucide-react';
import { StartLearningButton } from '../components/StartLearningButton';
import { version } from '../package.json';

const steps = [
  { title: '물음 선택', description: '기준서형 한 물음 또는\n사례형 문제를 고릅니다.', icon: BookOpen },
  { title: '답안 작성', description: '요구사항에 맞춰\n내 언어로 서술합니다.', icon: FileText },
  { title: '기준별 AI 판정', description: '독립적인 평가 요소별로\n충족 여부를 확인합니다.', icon: ListChecks },
  { title: '인용·점수 검증', description: '답안 근거를 확인하고\n기준별 점수를 합산합니다.', icon: ShieldCheck },
  { title: '피드백·복습', description: '놓친 내용을 보완하고\n다시 풀어봅니다.', icon: RotateCcw },
];

export default function Home() {
  return <div className="mx-auto w-full max-w-7xl">
    <section className="grid items-center gap-12 py-10 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-24" aria-labelledby="hero-title">
      <div>
        <p className="eyebrow flex items-center gap-2"><span className="h-px w-7 bg-primary" /> CPA 2차 · 회계감사 서술형 연습</p>
        <h1 id="hero-title" className="mt-6 text-[2.5rem] font-semibold leading-[1.28] tracking-[-0.05em] sm:text-5xl xl:text-[3.5rem]">내 답안에서<br />놓친 논점을<br /><span className="text-primary">확인하세요.</span></h1>
        <p className="mt-6 max-w-lg break-keep text-base leading-8 text-muted sm:text-lg">답안을 쓰고, 기준별 점수와 근거를 확인하세요.<br className="hidden sm:block" />빠뜨린 내용을 보완하며 다음 답안을 준비합니다.</p>
        <div className="mt-8 flex flex-wrap items-start gap-3"><StartLearningButton /><Link href="#grading" className="button-secondary min-h-12">채점 방식 보기 <ArrowDown aria-hidden="true" className="size-4" /></Link></div>
        <p className="mt-4 text-xs leading-6 text-muted">비회원으로 시작할 수 있습니다. 제출 결과는 7일간 보관됩니다.</p>
        <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted"><span className="flex items-center gap-1.5"><CheckCheck className="size-4 text-success" aria-hidden="true" />기준별 부분점수</span><span className="flex items-center gap-1.5"><Quote className="size-4 text-success" aria-hidden="true" />답안 근거 확인</span><span className="flex items-center gap-1.5"><RotateCcw className="size-4 text-success" aria-hidden="true" />오답노트 복습</span></div>
      </div>
      <figure className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-preview">
        <figcaption className="flex items-center justify-between gap-4 border-b border-card-border bg-surface-soft/40 px-5 py-4 text-xs text-muted"><span className="flex items-center gap-2 font-medium text-foreground"><FileCheck2 className="size-4" aria-hidden="true" />AuditSay / 학습 공간</span><span>화면 예시</span></figcaption>
        <div className="grid sm:grid-cols-[.85fr_1.15fr]">
          <div className="border-b border-card-border bg-background/50 p-5 sm:border-b-0 sm:border-r xl:p-6">
            <p className="eyebrow">문제 읽기</p><h2 className="mt-4 text-lg leading-7">판단과 근거를<br />연결하는 연습</h2>
            <div className="mt-6 rounded-lg border border-card-border bg-card p-4"><p className="text-xs font-medium">공통 사실관계</p><div className="mt-4 space-y-2.5" aria-hidden="true"><div className="h-1.5 w-full rounded bg-card-border" /><div className="h-1.5 w-4/5 rounded bg-card-border" /><div className="h-1.5 w-full rounded bg-card-border" /><div className="h-1.5 w-3/5 rounded bg-card-border" /></div></div>
            <p className="mt-5 text-xs leading-6 text-muted">물음에서 요구한 내용과<br />사례의 조건을 함께 확인합니다.</p>
            <span className="mt-6 inline-block rounded bg-surface-soft px-2 py-1 text-xs text-muted">서술형</span>
          </div>
          <div className="p-5 xl:p-6">
            <div className="flex justify-between gap-3 text-xs"><span className="font-medium">내 답안</span><span className="text-muted">작성 → 피드백</span></div>
            <div className="mt-4 rounded-lg border border-card-border bg-background p-4"><p className="text-sm leading-7 text-muted">답안의 문장과 채점기준을<br />함께 확인할 수 있습니다.</p></div>
            <div className="mt-7 flex items-end justify-between gap-3"><span className="text-xs text-muted">기준별 득점 예시</span><span className="text-3xl font-semibold tabular-nums">3<span className="ml-1 text-sm font-normal text-muted">/ 4점</span></span></div>
            <ul className="mt-4 divide-y divide-card-border border-y border-card-border">
              {['요구한 판단', '근거 제시', '사례 적용', '후속 조치'].map((label, index) => <li key={label} className="flex items-center justify-between gap-2 py-3 text-xs"><span className="flex items-center gap-2">{index < 3 ? <Check aria-hidden="true" className="size-3.5 text-success" /> : <Minus aria-hidden="true" className="size-3.5 text-warning" />}{label}</span><span className={index < 3 ? 'text-success' : 'text-warning'}>{index < 3 ? '충족 · 1/1' : '미충족 · 0/1'}</span></li>)}
            </ul>
          </div>
        </div>
        <p className="border-t border-card-border px-5 py-3 text-[11px] leading-5 text-muted">이해를 돕기 위한 화면·점수 예시입니다. 실제 문항의 채점 결과가 아닙니다.</p>
      </figure>
    </section>

    <section id="grading" className="border-y border-card-border py-16 sm:py-20" aria-labelledby="grading-title">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">HOW IT WORKS</p><h2 id="grading-title" className="mt-3 text-2xl sm:text-3xl">점수의 근거까지 확인하는 채점</h2></div><p className="max-w-sm text-sm leading-7 text-muted">문항별 채점기준에 따라 답안을 살펴보고,<br />독립적인 평가 요소의 득점을 합산합니다.</p></div>
      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">{steps.map(({ title, description, icon: Icon }, index) => <li key={title} className="border-t border-card-border pt-5"><div className="flex items-center justify-between"><Icon className="size-5 text-primary" aria-hidden="true" /><span className="text-xs tabular-nums text-muted">0{index + 1}</span></div><h3 className="mt-5 text-base">{title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted">{description}</p></li>)}</ol>
    </section>

    <section id="features" className="py-16 sm:py-20" aria-labelledby="features-title"><p className="eyebrow">A BETTER STUDY ROUTINE</p><h2 id="features-title" className="mt-3 text-2xl sm:text-3xl">쓰고, 확인하고, 다시 쓰는 공부</h2>
      <div className="mt-9 grid gap-5 md:grid-cols-3">{[
        { icon: BookOpen, title: '학습 목적에 맞는 물음', text: '기준서형은 한 물음씩, 사례형은 사실관계와 연결된 물음들을 함께 연습합니다.' },
        { icon: Quote, title: '내 답안에 연결된 피드백', text: '기준별 판정과 답안 인용을 함께 읽으며 어떤 내용으로 점수를 받았는지 확인합니다.' },
        { icon: RotateCcw, title: '복습으로 이어지는 기록', text: '회원은 풀이 기록과 오답노트에서 보완할 물음을 다시 확인하고 연습할 수 있습니다.' },
      ].map(({ icon: Icon, title, text }) => <article key={title} className="panel p-6 sm:p-7"><Icon className="size-6 text-primary" aria-hidden="true" /><h3 className="mt-6 text-lg">{title}</h3><p className="mt-3 text-sm leading-7 text-muted">{text}</p></article>)}</div>
    </section>

    <section className="mb-16 grid gap-7 border-y border-card-border py-10 md:grid-cols-3" aria-label="학습의 근거와 기록">
      <div><h3 className="flex items-center gap-2 text-sm"><BookOpen className="size-4 text-primary" aria-hidden="true" />기준서와 물음의 연결</h3><p className="mt-3 text-sm leading-7 text-muted">문제에 연결된 기준서와 주제를 확인하며 회계감사 시험 범위의 논점을 연습합니다.</p></div>
      <div><h3 className="flex items-center gap-2 text-sm"><ShieldCheck className="size-4 text-primary" aria-hidden="true" />점수의 근거 확인</h3><p className="mt-3 text-sm leading-7 text-muted">학습용 AI 피드백에서 기준별 판정과 실제 답안 인용을 함께 확인할 수 있습니다.</p></div>
      <div><h3 className="flex items-center gap-2 text-sm"><FileCheck2 className="size-4 text-primary" aria-hidden="true" />풀이 당시의 기록</h3><p className="mt-3 text-sm leading-7 text-muted">제출 답안과 채점 결과는 풀이 당시의 문제 판본에 연결해 보관합니다.</p></div>
    </section>
    <section className="grid gap-8 rounded-2xl border border-card-border bg-surface-soft/60 p-6 sm:p-10 lg:grid-cols-[.8fr_1.2fr]" aria-labelledby="career-title"><div><p className="eyebrow">YOUR NEXT CHAPTER</p><h2 id="career-title" className="mt-4 text-2xl leading-snug sm:text-3xl">합격 이후의 준비도<br />함께하세요.</h2><p className="mt-4 max-w-sm text-sm leading-7 text-muted">공시로 회계법인을 알아보고,<br />수습·신입 CPA 채용공고를 확인하세요.</p></div><div className="grid gap-4 sm:grid-cols-2"><Link href="/firms" className="panel group flex flex-col items-start p-6"><Building2 className="size-6 text-primary" aria-hidden="true" /><h3 className="mt-5 text-lg">회계법인 정보</h3><p className="mt-2 text-sm leading-7 text-muted">법인의 사업과 고객,<br />인력·보수 정보를 살펴보세요.</p><span className="mt-6 flex items-center gap-2 text-sm font-medium">법인 살펴보기 <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span></Link><Link href="/jobs" className="panel group flex flex-col items-start p-6"><BriefcaseBusiness className="size-6 text-primary" aria-hidden="true" /><h3 className="mt-5 text-lg">채용공고</h3><p className="mt-2 text-sm leading-7 text-muted">한국공인회계사회에 올라온<br />채용공고를 모아 확인하세요.</p><span className="mt-6 flex items-center gap-2 text-sm font-medium">공고 확인하기 <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span></Link></div></section>

    <section id="guide" className="grid gap-10 py-16 sm:py-20 md:grid-cols-[.8fr_1.2fr]" aria-labelledby="guide-title"><div><p className="eyebrow">GETTING STARTED</p><h2 id="guide-title" className="mt-3 text-2xl sm:text-3xl">시작하기 전에</h2><p className="mt-4 text-sm leading-7 text-muted">학습 방식과 기록 보관을 확인하세요.</p></div><div className="divide-y divide-card-border border-y border-card-border">{[
      ['비회원도 문제를 풀 수 있나요?', '비회원 세션으로 문제를 풀 수 있습니다. 제출한 답안과 채점 결과는 7일간 보관됩니다. 경험치·랭킹·오답노트는 회원에게 제공됩니다.'],
      ['어떤 기준으로 채점하나요?', '문항마다 설정된 독립적인 채점기준으로 답안을 판정합니다. 실제 득점과 최대 배점, 답안 근거를 함께 확인할 수 있습니다. 시험의 공식 채점을 대신하는 점수는 아닙니다.'],
      ['작성 중인 답안은 어디에 저장되나요?', '풀이 중인 답안은 이 브라우저의 현재 탭에 임시 저장됩니다. 새로고침 후 같은 물음에서 복원할 수 있으며, 탭을 닫으면 사라질 수 있습니다. 제출 후 저장되는 풀이 기록과는 구분됩니다.'],
      ['회계법인 정보와 채용공고는 어디에 있나요?', '상단 회계법인 메뉴에서 회계법인 정보와 채용공고를 전환할 수 있습니다. 공시 정보는 표시된 대상 연도를, 지원 조건과 마감 여부는 채용공고 원문을 확인하세요.'],
    ].map(([question, answer]) => <details key={question} className="py-5"><summary className="min-h-6 pr-2 text-sm font-medium sm:text-base">{question}</summary><p className="mt-4 text-sm leading-7 text-muted">{answer}</p></details>)}</div></section>

    <footer className="flex flex-wrap items-start justify-between gap-8 border-t border-card-border py-9 text-xs text-muted"><div><Link href="/" className="text-base font-semibold tracking-tight text-foreground">AuditSay</Link><p className="mt-2">회계감사 학습에서 다음 커리어까지.</p><details className="mt-4"><summary>버전 정보</summary><p className="mt-2">앱 v{version} · 문항별 판본은 각 풀이 기록에 연결됩니다.</p></details></div><div className="flex flex-wrap gap-x-6 gap-y-4"><Link href="#guide" className="hover:text-foreground">이용 안내</Link><Link href="/account" className="hover:text-foreground">계정 관리</Link><Link href="/settings" className="hover:text-foreground">채용 소식 설정</Link><a href="https://cta-tax-law.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">세법학 ↗</a></div><p className="w-full text-[11px]">Built with Next.js · Supabase · Vercel</p></footer>
  </div>;
}
