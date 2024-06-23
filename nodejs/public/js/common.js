// DOMContentLoaded 이벤트 리스너를 설정하여 페이지 로드 시 초기화 함수를 호출합니다.
document.addEventListener('DOMContentLoaded', initialize);

// 웹소켓 인스턴스와 서버 설정을 저장할 변수 선언
let ws;
let serverAddress;

// 애플리케이션 초기화 함수
async function initialize() {
    await fetchServerConfig(); // 서버 설정을 불러옵니다.
    connectWebSocket(); // 웹소켓에 연결합니다.
    updateTime(); // 현재 시간을 업데이트합니다.
}

// 서버 설정을 불러오는 함수
async function fetchServerConfig() {
    try {
        const config = await fetchJson('/config');
        serverAddress = config.serverAddress;
    } catch (error) {
        console.error("Failed to fetch server config:", error);
    }
}

// 웹소켓에 연결하고 이벤트 리스너를 설정하는 함수
function connectWebSocket() {
    ws = new WebSocket(`ws://${serverAddress}`);

    ws.onopen = () => console.log("Connected to WebSocket server");
    ws.onmessage = handleWebSocketMessage;
    ws.onerror = (error) => console.log("WebSocket error:", error);
}

// 웹소켓 메시지 이벤트를 처리하는 함수
function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log("Received message:", data);

    switch (data.type) {
        case 'user_response':
            if (typeof response === 'function') {
                response(data.chatID, data.message);
            }
            break;
        case 'ai_response':
            if (typeof response === 'function') {
                response(data.chatID, data.message, data.characterInfo);
            }
            break;
        default:
            console.log("Unknown message type:", data.type);
    }
}

// 뒤로가기
function goBack() {
    window.location.href = `/..`;
}

// 키보드 이벤트 리스너 설정
document.addEventListener('keydown', (event) => {
    if (event.key === 'F2') {
        if (typeof cheat === 'function') {
            cheat();
        }
    }
});

// 시간을 업데이트하는 함수
function updateTime() {
    const timeElement = document.querySelector('.time');
    timeElement.textContent = timeFormat();
    setTimeout(updateTime, 60000); // 1분마다 업데이트
}

// 시간 문자열을 '시:분' 형식으로 조합하는 함수
function timeFormat(time = new Date()) {
    time = new Date(time);
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 시간 지연을 위한 함수
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// JSON 형태로 POST 요청을 보내는 범용 함수
async function postJson(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('서버 응답 실패');
    return response.json();
}

// JSON 데이터를 가져오는 범용 함수
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('데이터를 불러올 수 없습니다.');
    return response.json();
}