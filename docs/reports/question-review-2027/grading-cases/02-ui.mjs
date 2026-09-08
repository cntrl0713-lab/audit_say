// Actual QuizClient and stylesheet, isolated auth/server-action adapters.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const require=createRequire(import.meta.url);
const runtime=process.env.CODEX_REVIEW_NODE_MODULES || 'C:/Users/cntrl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(`${runtime}/playwright`);
const dir='docs/reports/question-review-2027/grading-cases';
const sets=JSON.parse(fs.readFileSync(`${dir}/02-public.json`));
const offline=JSON.parse(fs.readFileSync(`${dir}/02-offline.json`)).offline;
const cases=JSON.parse(fs.readFileSync(`${dir}/02-cases.json`));
const results=Object.fromEntries(sets.map(s=>[s.id,offline.find(c=>c.id===`${s.id}-full`).result]));
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import QuizClient from './app/quiz/QuizClient.tsx';createRoot(document.getElementById('root')).render(<QuizClient initialSets={${JSON.stringify(sets)}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-boundaries',setup(b){b.onResolve({filter:/contexts\/AuthContext$|^\.\.\/actions$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.includes('AuthContext')?`export const useAuth=()=>({refreshProfile:async()=>{if(window.failRefresh)throw new Error('profile refresh failed')}});`:`export async function gradeQuestionSetV3Action(id,answers){window.lastSubmission={id,answers}; if(window.failGrade)return{ok:false,message:'시험용 서비스 실패'}; const r=structuredClone(${JSON.stringify(results)}[id]);r.subquestions.forEach(q=>q.user_answer=answers[q.subquestion_id]);return {ok:true,result:r};}`}));}}]});
const css=(await postcss([tailwind()]).process(fs.readFileSync('app/globals.css','utf8'),{from:'app/globals.css'})).css;
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style><body><main style="padding:24px"><div id="root"></div></main><script src="/bundle.js"></script></body></html>';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html; charset=utf-8');res.end(req.url==='/bundle.js'?bundle.outputFiles[0].text:html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const records=[];
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:1000}});
    for(const s of sets){
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.getByRole('button').filter({has:page.getByRole('heading',{name:s.title,exact:true})}).click();
      assert.equal(await page.locator('textarea').count(),2);
      const before=await page.locator('body').innerText();
      for(const q of s.subquestions)assert.ok(before.includes(q.prompt));
      const blankBlocked=await page.locator('form').evaluate(f=>!f.checkValidity());
      const answers=cases.find(c=>c.id===`${s.id}-full`).answers;
      for(const q of s.subquestions)await page.locator(`#${q.id}-answer`).fill(answers[q.id]);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      assert.equal(overflow,false);
      await page.screenshot({path:`${dir}/${s.id}-${width}-solving.png`,fullPage:true});
      await page.getByRole('button',{name:'세트 제출 및 AI 판정'}).click();
      await page.getByText('채점 완료',{exact:true}).waitFor();
      const submitted=await page.evaluate(()=>window.lastSubmission);
      assert.equal(submitted.id,s.id);assert.deepEqual(submitted.answers,answers);
      const after=await page.locator('body').innerText();
      for(const q of s.subquestions){for(const line of answers[q.id].split('\n'))assert.ok(after.includes(line));for(const a of results[s.id].subquestions.find(x=>x.subquestion_id===q.id).model_answer)assert.ok(after.includes(a));}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`${dir}/${s.id}-${width}-review.png`,fullPage:true});
      await page.getByRole('button',{name:'같은 세트 다시 풀기'}).click();
      assert.equal(await page.locator('#sub1-answer').inputValue(),'');
      for(const q of s.subquestions)await page.locator(`#${q.id}-answer`).fill('보존할 답안');
      await page.evaluate(()=>window.failGrade=true);
      await page.getByRole('button',{name:'세트 제출 및 AI 판정'}).click();
      await page.getByText('시험용 서비스 실패',{exact:true}).waitFor();
      assert.equal(await page.locator('#sub1-answer').inputValue(),'보존할 답안');
      await page.evaluate(()=>{window.failGrade=false;window.failRefresh=true;});
      await page.getByRole('button',{name:'세트 제출 및 AI 판정'}).click();
      await page.getByText('profile refresh failed',{exact:true}).waitFor();
      records.push({set_id:s.id,width,prompts:true,result_ownership:true,model_answers:true,horizontal_overflow:false,retry_reset:true,service_failure_preserves_answers:true,blank_html_submission_blocked:blankBlocked,profile_refresh_failure_returns_to_solving:true,textarea_maxlength:await page.locator('#sub1-answer').getAttribute('maxlength')});
    }
    await page.close();
  }
  console.log(JSON.stringify(records));
}finally{
  fs.writeFileSync(`${dir}/02-ui-results.json`,JSON.stringify({scope:'actual QuizClient + actual globals.css; auth and server action mocked; no live auth/database E2E',records},null,2)+'\n');
  if(browser)await browser.close();await new Promise(r=>server.close(r));
}

