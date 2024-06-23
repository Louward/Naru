const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const AIController = require('../controllers/AIController');
const DBController = require('../controllers/DBController');

const MESSAGE_TYPES = {
    MESSAGE_INPUT: 'messageInput',
    TIME_CK: 'timeCk',
};

let wss;
let timeInterval = 3000; // 응답 전달 대기 시간

function setupWebSocketServer(server) {
    wss = new WebSocket.Server({ server });
    const activeConnections = {};

    wss.on('connection', (ws) => {
        // Initialize ws.chatBuffers when a new connection is established
        ws.chatBuffers = {};

        const sessionId = uuidv4();
        activeConnections[sessionId] = ws; // 세션 ID와 웹소켓 연결을 저장
        console.log(`[세션 ID: ${sessionId} 연결]  사용자 수: ${Object.keys(activeConnections).length}`);

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            // 메시지 유형에 따라 적절한 처리를 수행합니다.
            switch (data.type) {
                case MESSAGE_TYPES.MESSAGE_INPUT:
                    handleUserMessage(data, ws);
                    break;
                case MESSAGE_TYPES.TIME_CK:
                    break;
                case 'input_status':
                    console.log(`User is ${data.status} in ${data.chatID}`);
                    handleInputStatus(ws, data.chatID);
                    break
                default:
                    console.log(`알 수 없는 메시지 유형: ${data.type}`);
            }
        });

        ws.on('close', () => {
            delete activeConnections[sessionId]; // 연결이 종료될 때 해당 세션 ID를 제거
            console.log(`[세션 ID: ${sessionId} 퇴장]  사용자 수: ${Object.keys(activeConnections).length}`);
        });

        ws.send(JSON.stringify({ type: 'welcome', message: 'WebSocket 연결이 성공적으로 설정되었습니다.' }));
    });

    return wss;
}

// 유저 메세지 처리 함수
async function handleUserMessage(data, ws) {
    // 여기에 금칙어등 입력 예외 처리하면 될듯?
    try {
        // 입력한 메시지 출력 및 저장
        await DBController.saveMessage(data.chatID, 'user', data.input);
        broadcastMessage({
            type: 'user_response',
            chatID: data.chatID,
            message: {
                sender: 'user',
                content: data.input,
                timestamp: Date.now()
            }
        });
        addToMessageBuffer(ws, data.chatID, data.input)
    } catch (error) {
        console.error(`사용자 메시지 처리 중 오류 발생: ${error}`);
    }
}

// 메시지 버퍼에 입력을 추가하고 타이머를 재설정하는 함수
function addToMessageBuffer(ws, chatID, input) {
    // 해당 chatID의 버퍼가 없으면 초기화
    if (!ws.chatBuffers[chatID]) {
        ws.chatBuffers[chatID] = {
            buffer: '',
            isProcessing: false,
            inputTimer: null,  // 각 채팅방 별로 타이머를 추가
             stopTypingCounter: 0
        };
    }

    let buffer = ws.chatBuffers[chatID];
    buffer.buffer += buffer.buffer ? `\n${input}` : input; // 이전 메시지가 있는 경우 줄바꿈 처리

    // 응답을 받으면 타이머 재설정
    resetInputTimer(ws, chatID);
}

// Handle typing status
function handleInputStatus(ws, chatID) {
    // Make sure the chat buffer exists for the chatID
    if (!ws.chatBuffers[chatID]) return

    if (ws.chatBuffers[chatID].buffer !== '') {
        resetInputTimer(ws, chatID);
    }
}

// 입력 타이머를 재설정하는 함수
function resetInputTimer(ws, chatID) {
    let buffer = ws.chatBuffers[chatID];

    // 기존 타이머가 설정되어 있다면 초기화
    if (buffer.inputTimer) clearTimeout(buffer.inputTimer);

    // 새로운 타이머 설정
    buffer.inputTimer = setTimeout(() => {
        processMessageBuffer(ws, chatID);
    }, timeInterval);
}

// 입력된 메시지를 AI에게 전송하는 함수
async function processMessageBuffer(ws, chatID) {
    let buffer = ws.chatBuffers[chatID];

    // AI가 응답중이라면 타이머 재설정
    if (buffer.isProcessing) {
        resetInputTimer(ws, chatID);
        return;
    }

    console.log(`Sending message to AI for chatID ${chatID}`);
    console.log(`user : ${buffer.buffer}`);

    // AI 응답 처리 시작
    const msg = buffer.buffer;
    buffer.buffer = '';
    await handleAIMessage(ws, chatID, msg);

    // 처리 후 버퍼에 새로운 메시지가 쌓여있다면 타이머 재설정
    if (buffer.buffer) {
        resetInputTimer(ws, chatID);
    }
}

// AI 메시지 처리 함수
async function handleAIMessage(ws, chatID, message) {
    let buffer = ws.chatBuffers[chatID];

    const { characters } = await DBController.getCharacterForChat(chatID);

    buffer.isProcessing = true;
    const AI = await AIController.sendMessageToAI(chatID, characters, message);
    const aiResponse = await AIController.getAIResponse(AI.threadId, AI.run);
    buffer.isProcessing = false;

    const character = await DBController.getCharacter(AI.characterID);
    console.log(`ㄴ 답변할 AI: ${character.name}, 시간: ${character.personality}`);

    setTimeout(() => {
        console.log(`${AI.characterID} : ${aiResponse}`);
        const responses = aiResponse.split("\n");
        responses.forEach((resp, index) => {
            const content = resp.trim(); // 응답의 앞뒤 공백 제거
            if (content) { // 내용이 실제로 있는 경우에만 작업 진행
                setTimeout(async () => { // 여기서 setTimeout을 사용하여 각 메시지 처리 사이에 1초 지연
                    await DBController.saveMessage(chatID, AI.characterID, content);
                    broadcastMessage({
                        type: 'ai_response',
                        chatID: chatID,
                        message: {
                            sender: AI.characterID,
                            content: content,
                            timestamp: Date.now()
                        },
                        characterInfo: {
                            name: character.name,
                            image: character.image
                        }
                    });
                }, index * 1000); // 각 메시지 전달 간격 지정
            }
        });
    }, character.personality); // 응답 대기
}

// 모든 연결된 클라이언트에게 메시지를 브로드캐스트하는 함수
function broadcastMessage(message) {
    const messageString = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

module.exports = { setupWebSocketServer };
