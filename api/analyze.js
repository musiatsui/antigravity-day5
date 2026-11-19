export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Vercel Serverless Function은 body가 문자열이거나 객체일 수 있습니다.
    let text;
    if (typeof req.body === 'string') {
      try {
        text = JSON.parse(req.body).text;
      } catch {
        text = req.body;
      }
    } else {
      text = req.body?.text;
    }

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: '일기 내용을 입력해 주세요.' });
      return;
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      res.status(500).json({
        error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정의 Environment Variables에 GEMINI_API_KEY를 등록해 주세요.'
      });
      return;
    }

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
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const apiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(15000),
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
          lastError = errMsg;
          continue;
        }

        const candidate = data.candidates?.[0];
        if (candidate?.content?.parts) {
          reply = candidate.content.parts
            .map(p => p.text || '')
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
      res.status(500).json({ error: lastError || 'AI 응답을 생성하지 못했습니다.' });
      return;
    }

    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: `서버 오류: ${err.message}` });
  }
}
