// DOM 요소 선택
const diaryInput = document.getElementById('diaryInput');
const charCount = document.getElementById('charCount');
const voiceBtn = document.getElementById('voiceBtn');
const voiceBtnText = document.getElementById('voiceBtnText');
const analyzeBtn = document.getElementById('analyzeBtn');
const aiResponseBox = document.getElementById('aiResponseBox');

// 글자 수 세기 기능
diaryInput.addEventListener('input', () => {
  charCount.textContent = diaryInput.value.length;
});

// 음성 인식 (Web Speech API) 설정
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    isRecording = true;
    voiceBtn.classList.add('listening');
    voiceBtnText.textContent = '음성 듣는 중... (클릭 시 중지)';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (diaryInput.value.trim().length > 0) {
      diaryInput.value += ' ' + transcript;
    } else {
      diaryInput.value = transcript;
    }
    charCount.textContent = diaryInput.value.length;
  };

  recognition.onerror = (event) => {
    console.error('음성 인식 오류:', event.error);
    alert('음성 인식 중 오류가 발생했거나 마이크 권한이 필요합니다.');
    stopRecording();
  };

  recognition.onend = () => {
    stopRecording();
  };
}

function stopRecording() {
  isRecording = false;
  voiceBtn.classList.remove('listening');
  voiceBtnText.textContent = '음성으로 입력하기';
}

// 음성 입력 버튼 클릭 이벤트
voiceBtn.addEventListener('click', () => {
  if (!SpeechRecognition) {
    alert('현재 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 권장합니다.');
    return;
  }

  if (isRecording) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (err) {
      console.warn('Recognition start failed:', err);
    }
  }
});

// 분석 요청하기 버튼 클릭 이벤트 (Gemini API 백엔드 연동)
analyzeBtn.addEventListener('click', async () => {
  const content = diaryInput.value.trim();

  if (!content) {
    alert('오늘의 일기 내용을 먼저 입력해 주세요!');
    diaryInput.focus();
    return;
  }

  // 분석 중 상태 표시
  aiResponseBox.classList.add('has-content');
  aiResponseBox.innerHTML = '🤖 <strong>Gemini AI가 당신의 감정을 분석하고 있습니다...</strong><br>잠시만 기다려주세요 ✨';
  analyzeBtn.disabled = true;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: content })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '분석 중 오류가 발생했습니다.');
    }

    // AI 답변 출력
    aiResponseBox.textContent = data.reply;

    // 1. 일기 내용과 AI 답변을 로컬 스토리지에 저장
    localStorage.setItem('diaryContent', content);
    localStorage.setItem('aiReply', data.reply);
  } catch (err) {
    console.error('분석 요청 에러:', err);
    // file:// 프로토콜로 열었거나 서버 미실행 시 안내
    if (window.location.protocol === 'file:') {
      aiResponseBox.innerHTML = `⚠️ <strong>로컬 서버 실행이 필요합니다.</strong><br><br>
API 키 보안 및 Gemini API 호출을 위해 터미널에서 아래 명령어로 서버를 실행한 후 접속해 주세요:<br>
<code>npm start</code><br><br>
접속 주소: <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>`;
    } else {
      aiResponseBox.innerHTML = `❌ <strong>오류 발생:</strong> ${err.message}`;
    }
  } finally {
    analyzeBtn.disabled = false;
  }
});

// 2. 페이지 로드 시 로컬 스토리지 데이터 복원
function loadSavedData() {
  const savedDiary = localStorage.getItem('diaryContent');
  const savedReply = localStorage.getItem('aiReply');

  if (savedDiary) {
    diaryInput.value = savedDiary;
    charCount.textContent = savedDiary.length;
  }

  if (savedReply) {
    aiResponseBox.classList.add('has-content');
    aiResponseBox.textContent = savedReply;
  }
}

// 초기화 실행
loadSavedData();
