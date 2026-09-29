const config = require('../config/config');
const llm = require('../llm');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Character = require('../models/Character');
const CharacterMemory = require('../models/CharacterMemory');

// 요약 작업이 진행 중인 채팅방 (중복 실행 방지)
const compacting = new Set();

// 다른 대화방 대화를 얼마나 가져올지
const OTHER_ROOM_HOURS = 48;
const OTHER_ROOM_MESSAGES = 8;

// 대화 한 줄을 "[이름] 내용" 형식으로 변환
function formatLine(message, names) {
    const name = message.sender === 'user' ? config.userName : (names[message.sender] || message.sender);
    return `[${name}] ${message.content}`;
}
exports.formatLine = formatLine;

async function loadNames(characterIDs) {
    const characters = await Character.find({ characterID: { $in: characterIDs } });
    return Object.fromEntries(characters.map(c => [c.characterID, c.characterName]));
}

// 프롬프트에 넣을 기억: 요약본 + 아직 요약되지 않은 최근 메시지
exports.getContext = async (chatID) => {
    const chat = await Chat.findOne({ chatID });
    const messageDoc = await Message.findOne({ chatID });
    const messages = messageDoc ? messageDoc.messages : [];
    const summarizedCount = chat?.memory?.summarizedCount || 0;

    return {
        summary: chat?.memory?.summary || '',
        recent: messages.slice(summarizedCount),
    };
};

// 캐릭터 개인 기억
exports.getCharacterMemory = async (characterID) => {
    const memory = await CharacterMemory.findOne({ characterID });
    return memory?.summary || '';
};

// 이 캐릭터가 참여한 다른 대화방의 최근 대화 (1:1에서 한 얘기를 단체방에서도 알 수 있게)
exports.getOtherRoomsRecent = async (characterID, currentChatID) => {
    const chats = await Chat.find({ characters: characterID, chatID: { $ne: currentChatID } });
    const since = Date.now() - OTHER_ROOM_HOURS * 3600000;
    const sections = [];

    for (const chat of chats) {
        const messageDoc = await Message.findOne({ chatID: chat.chatID });
        const recent = (messageDoc?.messages || [])
            .filter(m => new Date(m.timestamp).getTime() >= since)
            .slice(-OTHER_ROOM_MESSAGES);
        if (recent.length === 0) continue;

        const names = await loadNames(chat.characters);
        sections.push(`## ${chat.name} (${chat.roomType === 'group' ? '단체방' : '1:1'})\n`
            + recent.map(m => formatLine(m, names)).join('\n'));
    }
    return sections.join('\n\n');
};

// 요약되지 않은 메시지가 너무 많으면 오래된 부분을 요약본에 합친다 (응답 후 백그라운드로 호출)
// 대화방 기억과 함께, 참여한 캐릭터 각자의 개인 기억도 갱신한다
exports.compactIfNeeded = async (chatID) => {
    if (compacting.has(chatID)) return;
    compacting.add(chatID);

    try {
        const { compactThreshold, keepRecent, summaryMaxChars } = config.memory;
        const chat = await Chat.findOne({ chatID });
        const messageDoc = await Message.findOne({ chatID });
        if (!chat || !messageDoc) return;

        const summarizedCount = chat.memory?.summarizedCount || 0;
        const pending = messageDoc.messages.slice(summarizedCount);
        if (pending.length <= compactThreshold) return;

        const toFold = pending.slice(0, pending.length - keepRecent);
        const names = await loadNames(chat.characters);
        const transcript = toFold.map(m => `(${formatDate(m.timestamp)}) ${formatLine(m, names)}`).join('\n');
        console.log(`[${chatID} 기억 정리] 메시지 ${toFold.length}개를 요약에 반영`);

        const summary = await llm.generate({
            provider: config.llm.summaryProvider || undefined,
            system: buildRoomSummarySystem(summaryMaxChars),
            prompt: [
                '# 기존 기억',
                chat.memory?.summary || '(없음)',
                '',
                '# 새로 반영할 대화',
                transcript,
                '',
                '기존 기억에 새 대화를 합쳐 갱신된 기억 전체를 출력해.',
            ].join('\n'),
        });
        if (!summary) throw new Error('빈 요약 결과');

        await Chat.updateOne({ chatID }, {
            memory: {
                summary: summary.slice(0, summaryMaxChars * 1.5),
                summarizedCount: summarizedCount + toFold.length,
                updatedAt: new Date(),
            },
        });

        for (const characterID of chat.characters) {
            await updateCharacterMemory(characterID, names[characterID] || characterID, chat, transcript);
        }
    } catch (error) {
        console.error(`[${chatID} 기억 정리 실패]`, error.message);
    } finally {
        compacting.delete(chatID);
    }
};

async function updateCharacterMemory(characterID, name, chat, transcript) {
    const maxChars = config.memory.characterMaxChars;
    const existing = await CharacterMemory.findOne({ characterID });

    const summary = await llm.generate({
        provider: config.llm.summaryProvider || undefined,
        system: buildCharacterSummarySystem(name, maxChars),
        prompt: [
            `# ${name}의 기존 기억`,
            existing?.summary || '(없음)',
            '',
            `# 새로 반영할 대화 (대화방: ${chat.name}, ${chat.roomType === 'group' ? '단체방' : '1:1'})`,
            transcript,
            '',
            `${name}의 입장에서 갱신된 기억 전체를 출력해.`,
        ].join('\n'),
    });
    if (!summary) return;

    await CharacterMemory.updateOne(
        { characterID },
        { summary: summary.slice(0, maxChars * 1.5), updatedAt: new Date() },
        { upsert: true }
    );
}

function formatDate(date) {
    return new Date(date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const COMMON_RULES = `- 날짜는 대화 앞에 붙은 시각을 기준으로 쓴다. "다음주", "내일" 같은 말은 가능하면 실제 날짜로 바꿔 적는다.
- 기존 기억의 사실은 새 대화와 모순되지 않는 한 지우지 말고, 길어지면 오래된 것부터 압축한다.
- 추측이나 해석을 사실처럼 쓰지 않는다.
- 기록 본문만 출력한다. 인사말이나 설명을 붙이지 않는다.`;

function buildRoomSummarySystem(maxChars) {
    return `너는 메신저 대화방의 기억을 관리하는 기록 담당이다.
캐릭터가 나중에 이 기록만 보고도 지난 대화를 자연스럽게 이어갈 수 있도록 정리한다.

규칙:
- 한국어로, ${maxChars}자 이내.
- 아래 다섯 섹션 제목을 그대로 쓴다. 해당 내용이 없으면 섹션은 비워 둔다.
  ## ${config.userName}에 대해
  ## 관계
  ## 있었던 일
  ## 약속·진행 중인 이야기
  ## 기억할 만한 말
- 섹션별 내용: ${config.userName}에 대해 = 이름, 취향, 일상, 고민 등 알게 된 사실 / 관계 = 각 캐릭터와 ${config.userName}의 거리감, 호칭, 분위기 변화 / 있었던 일 = 날짜와 함께 시간 순으로, 오래된 일일수록 짧게 / 약속·진행 중인 이야기 = 아직 끝나지 않은 화제, 다음에 하기로 한 것 / 기억할 만한 말 = 인상적인 대사 몇 개만 짧게 인용
${COMMON_RULES}`;
}

function buildCharacterSummarySystem(name, maxChars) {
    return `너는 ${name}의 개인 기억을 관리하는 기록 담당이다.
${name}가 어느 대화방에서든 이 기록을 보고 ${config.userName}와의 지난 일을 떠올릴 수 있도록 정리한다.
${name}가 직접 겪거나 들은 것만 적는다. ${name}가 없던 대화방의 일은 적지 않는다.

규칙:
- 한국어로, ${maxChars}자 이내.
- 아래 세 섹션을 쓴다. 해당 내용이 없으면 섹션은 비워 둔다.
  ## ${config.userName}에 대해 아는 것
  ## ${config.userName}와의 관계와 추억 (어느 대화방에서 있었던 일인지 짧게 표시)
  ## ${name}가 한 약속·신경 쓰는 일
${COMMON_RULES}`;
}
