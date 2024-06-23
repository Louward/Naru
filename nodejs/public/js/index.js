// DOMContentLoaded 이벤트 리스너를 설정하여 페이지 로드 시 메시지를 불러옵니다.
document.addEventListener('DOMContentLoaded', fetchMessages);

// 서버에서 메시지 목록을 불러오고 화면에 표시하는 함수
async function fetchMessages() {
    try {
        const messages = await fetchJson('/api/list'); // 서버에서 메시지 목록을 가져옵니다.
        displayList(messages); // 화면에 메시지 목록을 표시합니다.
    } catch (error) {
        console.error('캐릭터 목록 불러오기 실패:', error);
    }
}

// 메시지 목록을 화면에 표시하는 함수
function displayList(messages) {
    const messageList = document.querySelector('.message-list');
    messageList.innerHTML = ''; // 기존 목록을 비웁니다.

    // messages 배열을 lastTime 기준으로 내림차순 정렬합니다.
    messages.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    // 각 메시지를 화면에 표시합니다.
    messages.forEach(message => {
        const listItem = createMessageItem(message); // 메시지 항목을 생성합니다.
        messageList.appendChild(listItem); // 생성된 항목을 리스트에 추가합니다.
    });
}

// 개별 메시지 항목을 생성하는 함수
function createMessageItem({ chatID, name, image, lastMessage, lastTime }) {
    const displayLastMessage = lastMessage || "";
    const displayLastTime = lastTime ? timeFormat(lastTime) : "";

    const listItem = document.createElement('li');
    listItem.className = 'message-item';
    listItem.innerHTML = `
        <img src="${image}" alt="${name}">
        <div class="content">
            <div class="character-name">${name}</div>
            <div class="last-message">${displayLastMessage}</div>
        </div>
        <div class="last-time">${displayLastTime}</div>
    `;

    // 클릭 이벤트를 설정하여 메시지 항목 클릭 시 해당 대화방으로 이동합니다.
    listItem.addEventListener('click', () => {
        moveToMessage(chatID);
    });

    return listItem;
}

// 응답을 처리하는 함수
async function response(chatID, message, characterInfo) {
    // 새 메시지가 chatID에 추가되었음을 감지하고 해당 대화 목록을 갱신
    try {
        const messages = await fetchJson('/api/list'); // 서버에서 메시지 목록을 가져옵니다.
        displayList(messages); // 화면에 메시지 목록을 표시합니다.
    } catch (error) {
        console.error(`메시지 목록 갱신 실패: ${error}`);
    }
}

// 특정 캐릭터의 대화방으로 이동하는 함수
function moveToMessage(chatID) {
    window.location.href = `/room/${chatID}`;
}