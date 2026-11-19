import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경변수에서 설정값 가져오기
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// MIME 타입 매핑
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  // 1. 감정 분석 API 엔드포인트: POST /api/analyze
  if (req.method === 'POST' && reqUrl.pathname === '/api/analyze') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body || '{}');

        if (!text || text.trim().length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ error: '일기 내용을 입력해 주세요.' }));
          return;
        }

        // 환경변수 확인
        if (!GEMINI_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({
            error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인해 주세요.'
          }));
          return;
        }

        // Gemini API 호출 프롬프트
        const systemPrompt = `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고 사용자의 감정을 한 단어(예: 기쁨. 슬픔, 분노, 불안, 평안)로 요약해줘. 그리고 그 감정에 공감해 주고 따뜻한 응원의 메세지를 2-3문장으로 작성해줘. 답변 형식은 반드시 '감정: [요약된 감정]\n\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.

일기 내용:
${text}`;

        // 지원되는 최신 Gemini 모델 목록 (순차적 시도 / 자동 대체)
        const candidateModels = Array.from(new Set([
          process.env.GEMINI_MODEL,
          'gemini-3.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-3.6-flash',
          'gemini-3.8-flash'
        ].filter(Boolean)));

        let reply = null;
        let lastError = null;

        for (const model of candidateModels) {
          try {
            console.log(`[Gemini API] 모델 시도 중: ${model}`);
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

            const apiResponse = await fetch(geminiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              signal: AbortSignal.timeout(12000),
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: systemPrompt }
                    ]
                  }
                ],
                generationConfig: {
                  maxOutputTokens: 1000,
                  temperature: 0.7
                }
              })
            });

            const data = await apiResponse.json();

            if (!apiResponse.ok) {
              const errMsg = data.error?.message || `모델 ${model} 호출 실패`;
              console.warn(`[${model}] 시도 실패 (${apiResponse.status}): ${errMsg}`);
              lastError = errMsg;
              continue; // 다음 모델로 재시도
            }

            // 모든 parts의 텍스트를 하나로 결합 (parts가 여러 개로 나뉘어 반환될 때 잘림 방지)
            const candidate = data.candidates?.[0];
            if (candidate?.content?.parts) {
              reply = candidate.content.parts
                .map(p => p.text || '')
                .join('')
                .trim();
            }

            if (reply) {
              console.log(`✅ [${model}] 응답 성공 (길이: ${reply.length}자)`);
              break;
            }
          } catch (modelErr) {
            console.warn(`[${model}] 오류:`, modelErr.message);
            lastError = modelErr.message;
          }
        }

        if (!reply) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
          res.end(JSON.stringify({ error: lastError || 'AI 응답을 생성하지 못했습니다.' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        console.error('Server error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ error: `서버 오류: ${err.message}` }));
      }
    });
    return;
  }

  // 2. 정적 파일 서비스 (index.html, style.css, script.js 등)
  let filePath = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  let fullPath = path.join(__dirname, 'public', filePath);
  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(__dirname, filePath);
  }

  // 보안: 디렉토리 탐색 방지
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 AI 감정일기 서버가 실행되었습니다!`);
  console.log(`🔗 로컬 접속 주소: http://localhost:${PORT}`);
  console.log(`🔑 GEMINI_API_KEY 로드 완료: ${GEMINI_API_KEY ? '성공 (설정됨)' : '미설정'}`);
  console.log(`=========================================`);
});
