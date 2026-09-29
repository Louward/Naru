// DOMContentLoaded 이벤트 리스너를 설정하여 페이지 로드 시 초기화 함수를 호출합니다.
document.addEventListener('DOMContentLoaded', initialize);

// 웹소켓 인스턴스
let ws;
let reconnectDelay = 1000;

// 애플리케이션 초기화 함수
function initialize() {
    connectWebSocket(); // 웹소켓에 연결합니다.
    updateTime(); // 현재 시간을 업데이트합니다.
}

// 웹소켓에 연결하고 이벤트 리스너를 설정하는 함수 (페이지를 연 주소로 접속)
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}`);

    ws.onopen = () => {
        reconnectDelay = 1000;
        if (typeof onSocketOpen === 'function') onSocketOpen();
    };
    ws.onmessage = handleWebSocketMessage;
    // 서버가 재시작되면 자동으로 다시 연결
    ws.onclose = () => {
        setTimeout(connectWebSocket, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 10000);
    };
}

// 서버로 메시지 보내기 (연결이 끊겨 있으면 무시)
function sendSocket(data) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

// 웹소켓 메시지 이벤트를 처리하는 함수 (페이지별 핸들러가 있으면 호출)
function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    const handlers = {
        user_response: () => typeof response === 'function' && response(data.chatID, data.message),
        ai_response: () => typeof response === 'function' && response(data.chatID, data.message, data.characterInfo),
        typing: () => typeof onTyping === 'function' && onTyping(data),
        read: () => typeof onRead === 'function' && onRead(data.chatID),
    };
    handlers[data.type]?.();
}

// 뒤로가기
function goBack() {
    window.location.href = '/';
}

// 시간을 업데이트하는 함수
function updateTime() {
    const timeElement = document.querySelector('.time');
    if (timeElement) timeElement.textContent = timeFormat();
    setTimeout(updateTime, 30000);
}

// 시간 문자열을 '오후 3:05' 형식으로
function timeFormat(time = new Date()) {
    return new Date(time).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

// 프로필 이미지 (이미지가 없거나 깨지면 이름 첫 글자로 된 아바타)
function createAvatar(name, image, className) {
    const fallback = () => {
        const div = document.createElement('div');
        div.className = `${className} avatar-fallback`;
        div.textContent = (name || '?').trim().charAt(0);
        div.style.background = avatarColor(name || '');
        return div;
    };
    if (!image) return fallback();

    const img = document.createElement('img');
    img.className = className;
    img.src = image;
    img.alt = name || '';
    img.onerror = () => img.replaceWith(fallback());
    return img;
}

function avatarColor(name) {
    const colors = ['#f08c3a', '#5b8def', '#d9577c', '#3fa37a', '#8a63d2', '#c79a2e'];
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return colors[hash % colors.length];
}

// 텍스트만 담는 요소 생성 (HTML로 해석하지 않음)
function createText(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
}

// JSON 데이터를 가져오는 범용 함수
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('데이터를 불러올 수 없습니다.');
    return response.json();
}
