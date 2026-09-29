const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Express 미들웨어 설정
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

// 페이지 엔드포인트
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'html', 'index.html')));
app.get('/room/:characterNumber', (req, res) => res.sendFile(path.join(__dirname, 'public', 'html', 'chat.html')));

// 라우팅 설정
app.use('/api', require('./routes/api'));

// DB 연결
require('./config/MongoDB');
const config = require('./config/config');

// 웹소켓 서버 설정
const { setupWebSocketServer } = require('./routes/webSocketServer');
const server = require('http').createServer(app);
setupWebSocketServer(server);

// 서버 실행알림
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
    console.log(`AI: ${config.llm.provider} (요약: ${config.llm.summaryProvider || config.llm.provider})`);
    require('./services/ProactiveService').start();
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});