// 페이지 로드 완료 시 초기화 함수 호출
document.addEventListener('DOMContentLoaded', initializeChat);

// DOM 요소 참조 및 상태
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const messageButton = document.getElementById('messageButton');
const typingArea = document.getElementById('typingArea');

const chatID = decodeURIComponent(window.location.pathname.split('/').pop());
let characters = {}; // characterID → { name, image }
let lastRendered = null; // 마지막으로 그린 메시지 { sender, minute, day, element }
const typingNow = new Map(); // 입력 중인 캐릭터 characterID → name

// 채팅방 초기화 함수
async function initializeChat() {
    await fetchChatroomData();
    setupEventListeners();
}

// 채팅방 정보 및 메시지 표시
async function fetchChatroomData() {
    try {
        const data = await fetchJson(`/api/${encodeURIComponent(chatID)}`);
        characters = data.characters;
        document.getElementById('chatname').textContent = data.chatname;
        document.title = `${data.chatname} - 블라블라`;

        if (data.roomType === 'group') {
            const count = document.getElementById('membercount');
            count.textContent = Object.keys(characters).length + 1;
            count.hidden = false;
        }

        messagesContainer.innerHTML = '';
        lastRendered = null;
        // 캐릭터가 마지막으로 말한 이후의 내 메시지는 아직 안 읽음
        let lastReplyIndex = -1;
        data.messages.forEach((m, i) => { if (m.sender !== 'user') lastReplyIndex = i; });
        data.messages.forEach((message, index) => {
            displayMessage(message, characters[message.sender], message.sender === 'user' && index > lastReplyIndex);
        });
        scrollToBottom();
    } catch (error) {
        console.error('Failed to fetch chatroom data:', error);
    }
}

// 메시지 하나를 화면에 추가
function displayMessage(message, characterInfo, unread = false) {
    const time = new Date(message.timestamp);
    const day = time.toDateString();
    const minute = `${day} ${time.getHours()}:${time.getMinutes()}`;

    if (!lastRendered || lastRendered.day !== day) {
        messagesContainer.appendChild(createText('div', 'date-divider',
            time.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })));
        lastRendered = null;
    }

    // 같은 사람이 같은 분에 연달아 보내면 프로필은 첫 메시지에만, 시간은 마지막 메시지에만
    const continued = lastRendered && lastRendered.sender === message.sender && lastRendered.minute === minute;
    if (continued) lastRendered.element.querySelector('.date')?.classList.add('hidden');

    const isUser = message.sender === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `message ${isUser ? 'sent' : 'received'}${continued ? ' continued' : ''}`;
    wrapper.dataset.sender = message.sender;

    const row = document.createElement('div');
    row.className = 'bubble-row';
    const bubble = createText('p', 'msg', message.content); // HTML로 해석하지 않음 (XSS 방지)
    const meta = document.createElement('div');
    meta.className = 'meta';
    if (isUser && unread) meta.appendChild(createText('span', 'unread', '1'));
    meta.appendChild(createText('span', 'date', timeFormat(time)));
    row.append(bubble, meta);

    if (isUser) {
        wrapper.appendChild(row);
    } else {
        const info = characterInfo || { name: message.sender };
        const body = document.createElement('div');
        body.className = 'body';
        if (!continued) body.appendChild(createText('div', 'character-name', info.name));
        body.appendChild(row);

        wrapper.append(
            continued ? createText('div', 'avatar-space', '') : createAvatar(info.name, info.image, 'character-image'),
            body
        );
    }

    messagesContainer.appendChild(wrapper);
    lastRendered = { sender: message.sender, minute, day, element: wrapper };
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 엔터 키 입력 및 클릭 이벤트 리스너 설정
function setupEventListeners() {
    messageInput.addEventListener('keydown', (event) => {
        // 한글 조합 중 Enter는 무시 (마지막 글자가 두 번 전송되는 문제 방지)
        if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            handleMessageSend();
        }
    });
    messageButton.addEventListener('click', handleMessageSend);

    // 입력 중이면 서버에 알려서 답장을 조금 기다리게 함
    let lastSent = 0;
    messageInput.addEventListener('input', () => {
        if (Date.now() - lastSent < 1500) return;
        lastSent = Date.now();
        sendSocket({ type: 'input_status', status: 'typing', chatID });
    });
}

// "보내기" 버튼 클릭 또는 엔터 키 입력 처리
function handleMessageSend() {
    const input = messageInput.value.trim();
    if (!input) return;
    messageInput.value = '';
    messageInput.focus();
    sendSocket({ type: 'messageInput', chatID, input });
}

// 웹소켓 연결(재연결) 시 읽음 처리
function onSocketOpen() {
    sendSocket({ type: 'seen', chatID });
}

// 새 메시지 수신
function response(targetChatID, message, characterInfo) {
    if (targetChatID !== chatID) return;

    if (characterInfo) {
        characters[message.sender] = characterInfo;
        typingNow.delete(message.sender);
        renderTyping();
        sendSocket({ type: 'seen', chatID });
    }

    const nearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 120;
    displayMessage(message, characters[message.sender], message.sender === 'user');
    if (nearBottom || message.sender === 'user') scrollToBottom();
}

// 캐릭터가 읽음 → 내 메시지의 "1" 제거
function onRead(targetChatID) {
    if (targetChatID !== chatID) return;
    messagesContainer.querySelectorAll('.unread').forEach(el => el.remove());
}

// 입력 중 표시
function onTyping({ chatID: targetChatID, characterID, name, typing }) {
    if (targetChatID !== chatID) return;
    if (typing) typingNow.set(characterID, name || characters[characterID]?.name || characterID);
    else typingNow.delete(characterID);
    renderTyping();
}

function renderTyping() {
    typingArea.innerHTML = '';
    if (typingNow.size === 0) return;

    const names = [...typingNow.values()].join(', ');
    const dots = document.createElement('span');
    dots.className = 'typing-dots';
    dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    typingArea.append(dots, createText('span', 'typing-text', `${names} 님이 입력 중`));
}
