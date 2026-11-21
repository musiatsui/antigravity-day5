import http from 'node:http';
import fs from 'node:fs';
import analyzeHandler from './api/analyze.js';

// 정적 파일 인메모리 로드 (초고속 서빙 및 번들링)
const INDEX_HTML = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf-8');
const STYLE_CSS = fs.readFileSync(new URL('./style.css', import.meta.url), 'utf-8');
const SCRIPT_JS = fs.readFileSync(new URL('./script.js', import.meta.url), 'utf-8');

const STATIC_FILES = {
  '/': { content: INDEX_HTML, type: 'text/html; charset=UTF-8' },
  '/index.html': { content: INDEX_HTML, type: 'text/html; charset=UTF-8' },
  '/style.css': { content: STYLE_CSS, type: 'text/css; charset=UTF-8' },
  '/script.js': { content: SCRIPT_JS, type: 'text/javascript; charset=UTF-8' }
};

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. 백엔드 서버리스 함수로 위임: /api/analyze
  if (reqUrl.pathname === '/api/analyze') {
    return analyzeHandler(req, res);
  }

  // 2. 정적 파일 서비스
  const staticAsset = STATIC_FILES[reqUrl.pathname];
  if (staticAsset) {
    res.writeHead(200, { 'Content-Type': staticAsset.type });
    res.end(staticAsset.content);
    return;
  }

  // 3. 404 처리
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end('404 Not Found');
});

export default server;

// 로컬 환경 실행
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 AI 감정일기 서버가 실행되었습니다!`);
    console.log(`🔗 로컬 접속 주소: http://localhost:${PORT}`);
    console.log(`=========================================`);
  });
}
