# 📖 AI 감정일기 (AI Emotion Diary)

> 안티그래비티 10일 챌린지 - Day 5

오늘 하루 있었던 일과 감정을 기록하면, Google Gemini AI가 감정을 분석하고 따뜻한 공감과 응원의 메시지를 전달해 주는 감정일기 웹 애플리케이션입니다.

---

## ✨ 주요 기능
- **일기 작성**: 여러 줄의 텍스트를 자유롭게 입력할 수 있는 감정일기 에디터 및 글자 수 카운터
- **음성 입력(STT)**: Web Speech API를 활용하여 음성을 텍스트로 바로 받아쓰기
- **Gemini AI 감정 분석**: 일기 내용을 바탕으로 감정을 한 단어로 요약하고 2~3문장의 따뜻한 응원 피드백 제공
- **로컬 스토리지 저장**: 작성한 일기와 AI의 답변이 브라우저에 자동 저장되어 새로고침 후에도 유지
- **안전한 API 키 관리**: `.env` 환경변수와 Node.js 백엔드 프록시를 통해 API 키 노출 방지

---

## 🚀 시작하기

### 1. 환경변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 발급받은 Gemini API 키를 입력합니다:

```env
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
PORT=3000
```

### 2. 서버 실행
별도의 패키지 설치 없이 Node.js(v20 이상) 내장 기능으로 바로 실행할 수 있습니다:

```bash
npm start
```

### 3. 접속
브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속합니다.
