const WebSocket = require('ws');

const DBController = require('../controllers/DBController');
const ReplyService = require('../services/ReplyService');
const { setServer, broadcast } = require('./broadcast');

const INPUT_WAIT_MS = 3000; // 사용자가 연달아 보내는 메시지를 모으는 시간

// 채팅방별 답장 대기 상태 { chatID: { timer, pending } }
const rooms = {};

function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({ server });
    setServer(wss);

    wss.on('connection', (ws) => {
        console.log(`[접속] 연결 수: ${wss.clients.size}`);

        ws.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            } catch (error) {
                console.error('잘못된 메시지 형식:', error.message);
                return;
            }

            switch (data.type) {
                case 'messageInput':
                    handleUserMessage(data.chatID, data.input);
                    break;
                case 'input_status':
                    // 사용자가 아직 입력 중이면 답장을 조금 더 기다림
                    if (rooms[data.chatID]?.pending) resetTimer(data.chatID);
                    break;
                case 'seen':
                    DBController.markRead(data.chatID).catch(error => console.error('읽음 처리 실패:', error.message));
                    break;
                default:
                    console.log(`알 수 없는 메시지 유형: ${data.type}`);
            }
        });

        ws.on('close', () => console.log(`[퇴장] 연결 수: ${wss.clients.size}`));
    });

    return wss;
}

// 사용자 메시지 저장 → 잠시 모았다가 답장
async function handleUserMessage(chatID, input) {
    const content = String(input || '').trim();
    if (!chatID || !content) return;

    try {
        await DBController.saveMessage(chatID, 'user', content);
        broadcast({
            type: 'user_response',
            chatID,
            message: { sender: 'user', content, timestamp: Date.now() },
        });

        rooms[chatID] = rooms[chatID] || { timer: null, pending: false };
        rooms[chatID].pending = true;
        resetTimer(chatID);
    } catch (error) {
        console.error(`사용자 메시지 처리 중 오류 발생: ${error.message}`);
    }
}

function resetTimer(chatID) {
    const room = rooms[chatID];
    clearTimeout(room.timer);
    room.timer = setTimeout(() => processRoom(chatID), INPUT_WAIT_MS);
}

async function processRoom(chatID) {
    const room = rooms[chatID];

    // 이미 답장 중이면 (먼저 연락하기 포함) 끝난 뒤에 다시 시도
    if (ReplyService.isBusy(chatID)) {
        resetTimer(chatID);
        return;
    }

    room.pending = false;
    await ReplyService.respond(chatID);

    // 답장하는 동안 사용자가 새 메시지를 보냈으면 이어서 답장
    if (room.pending) resetTimer(chatID);
}

module.exports = { setupWebSocketServer };
