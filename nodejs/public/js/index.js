// 페이지 로드 시 대화방 목록을 불러옵니다.
document.addEventListener('DOMContentLoaded', fetchList);

// 서버에서 대화방 목록을 불러오고 화면에 표시하는 함수
async function fetchList() {
    try {
        const rooms = await fetchJson('/api/list');
        displayList(rooms);
    } catch (error) {
        console.error('대화방 목록 불러오기 실패:', error);
    }
}

// 대화방 목록을 화면에 표시하는 함수
function displayList(rooms) {
    const list = document.querySelector('.message-list');
    list.innerHTML = '';

    if (rooms.length === 0) {
        list.appendChild(createText('li', 'empty', '대화방이 없습니다. npm run sync 로 캐릭터를 불러오세요.'));
        return;
    }

    // 최근 대화 순으로 정렬 (대화가 없는 방은 아래로)
    rooms.sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0));
    rooms.forEach(room => list.appendChild(createRoomItem(room)));
}

// 대화방 항목 생성
function createRoomItem({ chatID, name, image, roomType, memberCount, unread, lastMessage, lastTime }) {
    const item = document.createElement('li');
    item.className = 'message-item';

    const title = createText('div', 'room-name', name);
    if (roomType === 'group') title.appendChild(createText('span', 'member-count', String(memberCount + 1)));

    const content = document.createElement('div');
    content.className = 'content';
    content.append(title, createText('div', 'last-message', lastMessage || '새로운 대화를 시작해 보세요'));

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.appendChild(createText('div', 'last-time', lastTime ? listTimeFormat(lastTime) : ''));
    if (unread > 0) meta.appendChild(createText('div', 'unread-badge', unread > 99 ? '99+' : String(unread)));

    item.append(createAvatar(name, image, 'room-avatar'), content, meta);
    item.addEventListener('click', () => { window.location.href = `/room/${encodeURIComponent(chatID)}`; });
    return item;
}

// 오늘이면 시간, 어제면 '어제', 그 전이면 날짜
function listTimeFormat(time) {
    const date = new Date(time);
    const now = new Date();
    const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
    if (days === 0) return timeFormat(date);
    if (days === 1) return '어제';
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

// 새 메시지가 오면 목록 갱신
function response() {
    fetchList();
}
