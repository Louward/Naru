const WebSocket = require('ws');

let wss = null;

// 웹소켓 서버 등록 (webSocketServer.js에서 호출)
exports.setServer = (server) => { wss = server; };

// 모든 연결된 클라이언트에게 메시지 전송 (혼자 쓰는 로컬 앱이므로 모든 탭에 동기화)
exports.broadcast = (message) => {
    if (!wss) return;
    const messageString = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
};
