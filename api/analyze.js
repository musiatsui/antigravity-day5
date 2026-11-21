// Vercel 서버리스 함수: /api/analyze
// 사용자의 일기 내용을 백엔드에서만 처리하며, GEMINI_API_KEY는 클라이언트에 절대 노출되지 않습니다.

/**
 * 응답 전송 헬퍼 함수 (Vercel 및 표준 Node.js 환경 모두 호환)
 */
function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=UTF-8' });
  res.end(JSON.stringify(data));
}

/**
 * 요청 본문(body) 파싱 헬퍼 함수
 */
async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  // 1. CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight(사전 요청) 처리
  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      return res.status(200).end();
    }
    res.writeHead(204);
    res.end();
    return;
  }

  // POST 메서드만 허용 (보안 최적화)
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'POST 메서드만 지원합니다.' });
  }

  try {
    // 2. 요청 본문 파싱 및 일기 내용(text) 추출
    const body = await parseBody(req);
    const text = body?.text;

    if (!text || text.trim().length === 0) {
      return sendJson(res, 400, { error: '일기 내용을 입력해 주세요.' });
    }

    // 3. 보안: Vercel 서버리스 환경변수(process.env.GEMINI_API_KEY) 로드
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sendJson(res, 500, {
        error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정의 Environment Variables에 등록해 주세요.'
      });
    }

    // 4. Gemini API 호출 프롬프트 정의
    const systemPrompt = `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고 사용자의 감정을 한 단어(예: 기쁨. 슬픔, 분노, 불안, 평안)로 요약해줘. 그리고 그 감정에 공감해 주고 따뜻한 응원의 메세지를 2-3문장으로 작성해줘. 답변 형식은 반드시 '감정: [요약된 감정]\n\n[응원 메시지]'와 같이 줄바꿈을 포함해서 보내줘.

일기 내용:
${text}`;

    // 5. 지원 모델 목록 및 폴백 설정
    const candidateModels = Array.from(new Set([
      process.env.GEMINI_MODEL,
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.8-flash'
    ].filter(Boolean)));

    let reply = null;
    let lastError = null;

    // 6. Gemini REST API 순차 호출 (가장 안정적인 모델 우선)
    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const apiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(15000), // 15초 제한 시간
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
          lastError = data.error?.message || `모델 ${model} 호출 실패`;
          continue;
        }

        // 모든 조각(parts)의 텍스트를 하나로 결합
        const candidate = data.candidates?.[0];
        if (candidate?.content?.parts) {
          reply = candidate.content.parts
            .map((p) => p.text || '')
            .join('')
            .trim();
        }

        if (reply) {
          break;
        }
      } catch (modelErr) {
        lastError = modelErr.message;
      }
    }

    if (!reply) {
      return sendJson(res, 500, {
        error: lastError || 'AI 감정 분석 응답을 생성하지 못했습니다.'
      });
    }

    // 7. 성공 결과 반환
    return sendJson(res, 200, { reply });

  } catch (err) {
    console.error('Serverless function error:', err);
    return sendJson(res, 500, { error: `서버 오류: ${err.message}` });
  }
}
