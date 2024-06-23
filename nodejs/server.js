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

// 서버 설정 정보 제공 엔드포인트
const config = require('./config/config');
require('./config/MongoDB');
app.get('/config', (req, res) => res.json({ serverAddress: config.serverAddress, timeInterval: config.timeInterval }));

// 웹소켓 서버 설정
const { setupWebSocketServer } = require('./routes/webSocketServer');
const server = require('http').createServer(app);
setupWebSocketServer(server);

// 서버 실행알림
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
});

// 임시 처리
const { cleanupThreads, updateOpenAI } = require('./controllers/AIController');

// 서버 종료
process.on('SIGINT', async () => {
    console.log('---------------서버 종료 준비 중...---------------');
    try {
        await cleanupThreads(); // 스레드 정리
        await updateOpenAI(); // 대화 내용 저장 및 업데이트
    } catch (error) {
        console.error('서버 종료 중 오류 발생:', error);
    } finally {
        console.log('---------------모든 처리가 완료되었습니다!---------------');
        process.exit(0);
    }
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});