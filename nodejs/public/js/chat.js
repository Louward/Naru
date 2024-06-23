// 페이지 로드 완료 시 초기화 함수 호출
document.addEventListener('DOMContentLoaded', initializeChat);

// DOM 요소 참조 및 변수 초기화
let messagesContainer = document.getElementById('messages');
let messageInput = document.getElementById('messageInput');
let messageButton = document.getElementById('messageButton');

// 채팅방 초기화 함수
async function initializeChat() {
    const chatID = extractChatId();
    await threadCheck(chatID);
    await fetchChatroomData(chatID);
    setupEventListeners();
    setupMessageInputEventListener();
}

// 채팅방 ID 추출 함수
function extractChatId() {
    const pathSegments = window.location.pathname.split('/');
    return pathSegments.pop();
}

// 서버에 채팅방 이동을 알리는 함수
async function threadCheck(chatID) {
    try {
        const responseOk = await postJson('/api/enter', { chatID });
        if (!responseOk) throw new Error('Thread check failed');
    } catch (error) {
        console.error('Failed to perform thread check:', error);
    }
}

// 채팅방 정보 및 메시지 표시 함수
async function fetchChatroomData(chatID) {
    try {
        const { chatname, characters, messages } = await fetchJson(`/api/${chatID}`);
        displayChatroomInfo(chatname);
        displayMessages(characters, messages);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error('Failed to fetch chatroom data:', error);
    }
}

// 채팅방 정보를 화면에 표시하는 함수
function displayChatroomInfo(chatname) {
    document.getElementById('chatname').textContent = chatname;
    messagesContainer.innerHTML = ''; // 기존 메시지를 클리어
}

// 메시지들을 화면에 표시하는 함수
function displayMessages(characters, messages) {
    let previousSender = null;
    messages.forEach((message, index) => {
        const characterInfo = characters[message.sender];
        const displayInfo = message.sender !== previousSender;
        const showTimeSpan = index === messages.length - 1 || message.sender !== messages[index + 1].sender;
        displayMessage(message, characterInfo, displayInfo, showTimeSpan);
        previousSender = message.sender;
    });
}

// 메시지를 화면에 표시하는 함수
function displayMessage(message, characterInfo, displayInfo, showTimeSpan = true) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message', message.sender === 'user' ? 'sent' : 'received');

    // 발신자 정보를 data-sender 속성으로 추가
    messageWrapper.setAttribute('data-sender', message.sender);

    if (displayInfo && characterInfo) messageWrapper.appendChild(createInfo(characterInfo));
    messageWrapper.appendChild(createMessageArea(message.content, message.timestamp, showTimeSpan));

    messagesContainer.appendChild(messageWrapper);
}

// 캐릭터 정보를 화면에 표시하는 함수
function createInfo(characterInfo) {
    const characterInfoDiv = document.createElement('div');
    characterInfoDiv.className = 'character-info';
    characterInfoDiv.innerHTML = `
        <img src="${characterInfo.image}" alt="${characterInfo.name}" class="character-image">
        <div class="character-name">${characterInfo.name}</div>
    `;
    return characterInfoDiv;
}

// 메시지 영역 생성 함수
function createMessageArea(content, timestamp, showTimeSpan) {
    const msgAreaDiv = document.createElement('div');
    msgAreaDiv.className = 'msg_area';

    const msgBoxDiv = document.createElement('div');
    msgBoxDiv.className = 'msg_box';
    msgBoxDiv.innerHTML = `<p class="msg">${content}</p>`;

    msgAreaDiv.appendChild(msgBoxDiv);
    msgAreaDiv.appendChild(createStatusBox(timestamp, showTimeSpan));

    return msgAreaDiv;
}

// 상태 박스 생성 함수
function createStatusBox(timestamp, showTimeSpan) {
    const statusBoxDiv = document.createElement('div');
    statusBoxDiv.className = 'status_box';
    statusBoxDiv.innerHTML = `<span class="read"></span><span class="date">${timeFormat(timestamp)}</span>`;

    if (!showTimeSpan) {
        statusBoxDiv.querySelector('.date').style.display = 'none';
    }

    return statusBoxDiv;
}

// 엔터 키 입력 및 클릭 이벤트 리스너 설정
function setupEventListeners() {
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleMessageSend();
        }
    });
    messageButton.addEventListener('click', handleMessageSend);
}

// "보내기" 버튼 클릭 또는 엔터 키 입력 처리 함수
function handleMessageSend() {
    const input = messageInput.value.trim();
    if (input) {
        messageInput.value = ''; // 입력 필드 클리어
        userResponse(input); // 사용자 메시지 처리
    }
}

// 사용자 입력을 처리하는 함수
function userResponse(input) {
    ws.send(JSON.stringify({
        type: 'messageInput',
        chatID: extractChatId(),
        input: input
    }));
}

// 메시지 입력 필드에 대한 입력 이벤트 리스너를 설정하는 함수
function setupMessageInputEventListener() {
    const typingInterval = 2000; // 대기 간격

    const throttledSendTypingStatus = throttle(() => {
        sendTypingStatus('typing');
    }, typingInterval);

    const debouncedSendStoppedTypingStatus = debounce(() => {
        if (messageInput.value.trim()) {
            sendTypingStatus('stopped_typing');

            // 입력 필드가 비어있지 않다면 debounce 함수를 재귀적으로 호출하여 계속 상태를 체크
            debouncedSendStoppedTypingStatus();
        }
    }, typingInterval);

    messageInput.addEventListener('input', () => {
        throttledSendTypingStatus();
        debouncedSendStoppedTypingStatus(); // 사용자가 입력을 멈췄을 때 'stopped_typing' 상태를 체크
    });

    // 입력 상태를 서버에 보내는 함수
    function sendTypingStatus(status) {
        ws.send(JSON.stringify({
            type: 'input_status',
            status: status,
            chatID: extractChatId()
        }));
    }
}

// Throttle 함수 구현
function throttle(callback, limit) {
    let waiting = false;
    return function () {
        if (!waiting) {
            callback.apply(this, arguments);
            waiting = true;
            setTimeout(() => {
                waiting = false;
            }, limit);
        }
    };
}

// Debounce 함수 구현
function debounce(callback, delay) {
    let timeoutID;
    return function () {
        clearTimeout(timeoutID);
        timeoutID = setTimeout(() => {
            callback.apply(this, arguments);
        }, delay);
    };
}

// 응답을 처리하는 함수
function response(chatID, message, characterInfo) {
    if (chatID !== extractChatId()) {
        // 여기서 다른 채팅방 알림 처리 가능
        return
    } 

    const displayInfo = hideLastTimeSpan(message.sender);
    displayMessage(message, characterInfo, displayInfo);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 마지막 시간 간격을 숨기는 함수
function hideLastTimeSpan(sender = 'user') {
    const lastMessage = messagesContainer.querySelector(`.message[data-sender="${sender}"]:last-child`)

    if (lastMessage && lastMessage.classList.contains(sender === 'user' ? 'sent' : 'received')) {
        const lastTimeSpan = lastMessage.querySelector('.status_box .date');
        if (lastTimeSpan) {
            lastTimeSpan.style.display = 'none';
            return false;
        }
    }

    return true;
}

// 사용자 입력 활성화/비활성화를 제어하는 함수
function toggleInput(isDisabled) {
    messageButton.disabled = isDisabled;
    messageInput.disabled = isDisabled;

    isDisabled ? messageInput.blur() : messageInput.focus();
}

function cheat() {
    ws.send(JSON.stringify({ type: 'timeCk' }));
}