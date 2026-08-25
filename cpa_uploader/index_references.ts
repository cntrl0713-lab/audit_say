import * as fs from 'fs';
import * as path from 'path';

// API 인증 설정
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('❌ 에러: GEMINI_API_KEY 또는 GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

async function run() {
  const referencesDir = path.join(__dirname, 'references');
  if (!fs.existsSync(referencesDir)) {
    console.error(`❌ 에러: 기준서 디렉토리가 존재하지 않습니다: ${referencesDir}`);
    process.exit(1);
  }

  // 1. 기준서 디렉토리 내의 모든 마크다운(*.md) 파일 탐색
  const files = fs.readdirSync(referencesDir)
    .filter(file => file.endsWith('.md') && file !== 'structure.md')
    .map(file => ({
      fileName: file,
      filePath: path.join(referencesDir, file)
    }));

  if (files.length === 0) {
    console.log('⚠️ 업로드할 마크다운 파일이 없습니다.');
    return;
  }

  console.log(`📂 총 ${files.length}개의 기준서 파일을 찾았습니다.`);

  // 2. 신규 File Search Store 생성
  const storeDisplayName = `cpa_audit_references_${Date.now()}`;
  console.log(`⚙️ File Search Store 생성 중: ${storeDisplayName}...`);
  
  const createStoreUrl = `https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${apiKey}`;
  const storeRes = await fetch(createStoreUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: storeDisplayName,
      embeddingModel: 'models/gemini-embedding-2'
    })
  });

  const storeData: any = await storeRes.json();
  if (storeRes.status !== 200 || !storeData.name) {
    console.error('❌ 에러: File Search Store 생성 실패:', storeData);
    process.exit(1);
  }

  const storeName = storeData.name;
  console.log(`✅ Store 생성 완료! 이름: ${storeName}`);

  // 3. 파일 순차 업로드 및 스토어에 임포트
  for (let i = 0; i < files.length; i++) {
    const { fileName, filePath } = files[i];
    const progress = `[${i + 1}/${files.length}]`;
    console.log(`\n🔹 ${progress} 파일 직접 업로드 시작: ${fileName}...`);

    try {
      const fileStats = fs.statSync(filePath);
      const numBytes = fileStats.size;

      // 3-1. Resumable Upload 세션 시작 요청
      const uploadStartUrl = `https://generativelanguage.googleapis.com/upload/v1beta/${storeName}:uploadToFileSearchStore?key=${apiKey}`;
      const uploadStartRes = await fetch(uploadStartUrl, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(numBytes),
          'X-Goog-Upload-Header-Content-Type': 'text/plain',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ displayName: fileName })
      });

      const uploadUrl = uploadStartRes.headers.get('x-goog-upload-url');
      if (!uploadUrl) {
        throw new Error(`업로드 세션 URL 획득 실패. 응답: ${await uploadStartRes.text()}`);
      }

      // 3-2. 바이너리 전송 (Finalize)
      const fileBuffer = fs.readFileSync(filePath);
      const uploadFinishRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Length': String(numBytes),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize'
        },
        body: fileBuffer
      });

      const uploadFinishData: any = await uploadFinishRes.json();
      if (uploadFinishRes.status !== 200 || !uploadFinishData.name) {
        throw new Error(`파일 전송 실패. 응답: ${JSON.stringify(uploadFinishData)}`);
      }

      const operationName = uploadFinishData.name;
      console.log(`   - 파일 전송 완료. 백그라운드 인덱싱 중 (Operation: ${operationName})`);

      // 3-3. Operation 완료 Polling 대기
      let done = false;
      while (!done) {
        const opRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`);
        const opData: any = await opRes.json();
        
        if (opRes.status === 200 && opData.done) {
          done = true;
          console.log(`\n   - 인덱싱 완료!`);
        } else if (opRes.status !== 200) {
          throw new Error(`Polling 오류: ${JSON.stringify(opData)}`);
        } else {
          process.stdout.write('.');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

    } catch (err: any) {
      console.error(`\n❌ ${fileName} 처리 중 오류 발생:`, err.message || err);
      console.log('다음 파일 처리를 시도합니다.');
    }
  }

  // 4. 설정 파일에 저장
  const configDir = path.join(__dirname, 'data');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = path.join(configDir, 'rag_config.json');
  const configData = {
    fileSearchStoreName: storeName,
    displayName: storeDisplayName,
    createdAt: new Date().toISOString(),
    fileCount: files.length
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  console.log(`\n============================================================`);
  console.log(`🎉 모든 임베딩 작업이 성공적으로 완료되었습니다!`);
  console.log(`📝 RAG 설정이 저장되었습니다: ${configPath}`);
  console.log(`🔑 사용 스토어 ID: ${storeName}`);
  console.log(`============================================================`);
}

run().catch(err => {
  console.error('❌ 실행 중 예외 발생:', err);
  process.exit(1);
});
