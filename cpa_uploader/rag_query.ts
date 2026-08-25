import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// API 인증 설정
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('❌ 에러: GEMINI_API_KEY 또는 GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// 설정 파일 경로
const configPath = path.join(__dirname, 'data', 'rag_config.json');

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    console.error('❌ 에러: RAG 설정 파일(rag_config.json)을 찾을 수 없습니다. 먼저 기준서 임베딩(npm run rag:index)을 완료해 주세요.');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('❌ 에러: 설정 파일 파싱에 실패했습니다.', err);
    process.exit(1);
  }
}

async function queryRAG(question: string, storeName: string) {
  console.log(`\n🔍 질문 전송 중: "${question}"`);
  console.log(`⚙️ 연결된 RAG 스토어: ${storeName}`);
  console.log('⏳ Gemini RAG 모델 응답 대기 중...\n');

  try {
    const interaction = await ai.interactions.create({
      // File Search를 지원하는 안정적인 최신 모델 사용
      model: "gemini-3.5-flash",
      input: question,
      tools: [{
        type: "file_search",
        file_search_store_names: [storeName]
      }]
    });

    console.log('============================================================');
    console.log('🤖 [Gemini RAG 답변]');
    console.log('============================================================');

    let citationList: any[] = [];

    for (const step of interaction.steps) {
      if (step.type === 'model_output' && step.content) {
        for (const contentBlock of step.content) {
          if (contentBlock.type === 'text') {
            console.log(contentBlock.text);
            if (contentBlock.annotations) {
              citationList = contentBlock.annotations;
            }
          }
        }
      }
    }

    if (citationList.length > 0) {
      console.log('\n============================================================');
      console.log('📚 [참조 출처 및 기준서]');
      console.log('============================================================');
      const uniqueCitations = new Map<string, string>();
      for (const annotation of citationList) {
        if (annotation.type === 'file_citation') {
          const fileName = annotation.file_name || '알 수 없음';
          const pageInfo = annotation.page_number ? ` (p.${annotation.page_number})` : '';
          const key = `${fileName}${pageInfo}`;
          if (annotation.source) {
            uniqueCitations.set(key, annotation.source);
          }
        }
      }
      
      let index = 1;
      uniqueCitations.forEach((source, key) => {
        console.log(`[${index++}] 파일: ${key}`);
        console.log(`    근거 문구: "${source.trim().substring(0, 150)}..."\n`);
      });
    }
    console.log('============================================================\n');

  } catch (err: any) {
    console.error('❌ RAG 질의 수행 중 오류 발생:', err.message || err);
  }
}

async function main() {
  const config = loadConfig();
  const storeName = config.fileSearchStoreName;

  // 명령행 인자가 있으면 즉시 쿼리
  if (process.argv[2]) {
    const question = process.argv.slice(2).join(' ');
    await queryRAG(question, storeName);
    return;
  }

  // 인자가 없으면 대화식 프롬프트 대기
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('============================================================');
  console.log('🗣️ CPA 회계감사 기준서 RAG 질의 시스템에 오신 것을 환영합니다.');
  console.log('❓ 질문을 입력해 주세요. (종료하려면 exit 입력)');
  console.log('============================================================');

  const ask = () => {
    rl.question('\n📝 질문 > ', async (input) => {
      const trimmed = input.trim();
      if (trimmed.toLowerCase() === 'exit') {
        rl.close();
        return;
      }
      if (trimmed.length > 0) {
        await queryRAG(trimmed, storeName);
      }
      ask();
    });
  };

  ask();
}

main().catch(err => {
  console.error('❌ 실행 예외:', err);
  process.exit(1);
});
