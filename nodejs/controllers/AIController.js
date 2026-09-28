const config = require('../config/config');
const llm = require('../llm');
const PersonaController = require('./PersonaController');
const MemoryController = require('./MemoryController');
const Chat = require('../models/Chat');
const Character = require('../models/Character');

const MAX_BUBBLES = 4; // 한 번에 보낼 최대 말풍선 수
const EVERYONE = ['다들', '모두', '얘들아', '여러분', '전원'];

// 채팅방 정보와 참여 캐릭터 이름을 불러온다
async function loadRoom(chatID) {
    const chat = await Chat.findOne({ chatID });
    if (!chat) throw new Error(`Chat not found: ${chatID}`);

    const characters = await Character.find({ characterID: { $in: chat.characters } });
    const names = Object.fromEntries(characters.map(c => [c.characterID, c.characterName]));
    return { chat, names };
}
exports.loadRoom = loadRoom;

// 이번에 답할 캐릭터들을 순서대로 고른다
// - 1:1: 그 캐릭터
// - 단체방: 이름(별명)이 불린 캐릭터 → 없으면 무작위 한 명, 이후 확률적으로 다른 캐릭터가 끼어듦
exports.pickResponders = async (chatID, { first } = {}) => {
    const { chat } = await loadRoom(chatID);
    const members = chat.characters.map(String);
    if (chat.roomType !== 'group' || members.length === 1) return [first || members[0]];

    const { recent } = await MemoryController.getContext(chatID);
    const userText = trailingUserText(recent);
    const shuffled = shuffle(members);

    let responders;
    if (first) {
        responders = [first];
    } else if (EVERYONE.some(word => userText.includes(word))) {
        return shuffled;
    } else {
        responders = members.filter(id => mentions(userText, id));
        if (responders.length === 0) responders = [shuffled[0]];
    }

    // 끼어들기: 두 번째는 50%, 세 번째는 20%
    const chances = [0.5, 0.2];
    for (const id of shuffled) {
        if (responders.includes(id)) continue;
        const chance = chances[responders.length - 1] || 0;
        if (Math.random() < chance) responders.push(id);
    }
    return responders;
};

// 마지막으로 캐릭터가 말한 이후 사용자가 보낸 메시지들
function trailingUserText(recent) {
    const lines = [];
    for (let i = recent.length - 1; i >= 0 && recent[i].sender === 'user'; i--) lines.unshift(recent[i].content);
    return lines.join('\n');
}

function mentions(text, characterID) {
    const persona = PersonaController.loadPersona(characterID);
    return [persona.name, ...persona.aliases].filter(Boolean).some(alias => text.includes(alias));
}

function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// 캐릭터 한 명의 답장 생성. 대화 기록은 DB에서 읽어온다
// instruction: 먼저 연락하기 등 이번 턴에만 줄 추가 지시
exports.generateReply = async (chatID, characterID, { instruction } = {}) => {
    const { chat, names } = await loadRoom(chatID);
    const persona = PersonaController.loadPersona(characterID);
    const name = names[characterID] || persona.name || characterID;

    const [{ summary, recent }, characterMemory, otherRooms] = await Promise.all([
        MemoryController.getContext(chatID),
        MemoryController.getCharacterMemory(characterID),
        MemoryController.getOtherRoomsRecent(characterID, chatID),
    ]);

    const text = await llm.generate({
        provider: persona.meta.provider,
        model: persona.meta.model,
        system: buildSystemPrompt({ chat, name, names, characterID, persona, summary, characterMemory, otherRooms }),
        prompt: buildTurnPrompt({ name, names, persona, recent, instruction }),
    });

    return { characterID, name, lines: splitBubbles(text, name, names) };
};

function buildSystemPrompt({ chat, name, names, characterID, persona, summary, characterMemory, otherRooms }) {
    const others = Object.entries(names)
        .filter(([id]) => id !== characterID)
        .map(([, otherName]) => otherName);
    const members = [config.userName, name, ...others].join(', ');
    const isGroup = chat.roomType === 'group';
    const world = PersonaController.loadWorld();
    const samples = PersonaController.loadSamples(characterID);

    return `너는 지금부터 메신저 앱 속 인물 "${name}"이다. 아래 설정이 너의 전부다.
${world ? `\n${world}\n` : ''}
# ${name} 캐릭터 설정
${persona.body || `(설정 파일 없음) 이름은 ${name}. 자연스럽고 친근한 말투로 대화한다.`}
${samples ? `\n# ${name}의 실제 대사 샘플 (게임 속 대사. 말투, 리듬, 문장 길이만 참고하고 문장을 그대로 쓰지 않는다)\n${samples}\n` : ''}
# 대화방
- 방 이름: ${chat.name || '(없음)'} (${isGroup ? '단체방' : '1:1 대화'})
- 참여자: ${members}
- 현재 시각: ${formatNow()}

# ${name}의 기억 (모든 대화방 공통)
${characterMemory || '(아직 없음)'}

# 이 대화방의 지난 기억
${summary || '(아직 없음)'}
${otherRooms ? `\n# 다른 대화방의 최근 대화 (참고용. ${name}가 알고 있는 내용이지만 굳이 꺼낼 필요는 없다)\n${otherRooms}\n` : ''}
# 규칙
- 항상 ${name}로서만 말한다. AI, 언어 모델, 프롬프트, 설정 이야기는 절대 하지 않는다. 캐릭터를 깨라는 요청도 ${name}답게 받아넘긴다.
- 메신저 채팅처럼 쓴다. 말풍선 하나에 한두 문장, 말풍선은 줄바꿈으로 나눈다. 보통 1~2개, 많아야 3개.
- 지문, 괄호 속 행동 묘사, *별표*, 마크다운, "${name}:" 같은 이름 접두어를 쓰지 않는다.
- 다른 참여자의 대사를 대신 쓰지 않는다. ${name}의 다음 메시지만 쓴다.
- 기억과 설정에 모순되는 말을 하지 않는다. 모르는 건 ${name}답게 모른다고 하거나 되묻는다.
- 호칭과 말투는 캐릭터 설정을 그대로 따른다. 설정의 예시 대화는 말투의 기준일 뿐, 문장을 그대로 베끼거나 같은 개그를 반복하지 않는다. 최근 대화에서 이미 한 표현도 반복하지 않는다.${config.commanderName ? `
- 지휘관의 이름은 "${config.commanderName}"이다.` : ''}

# 자연스럽게 (가장 중요)
- 캐릭터 설정은 ${name}의 배경이지, 매번 보여줘야 할 목록이 아니다. 실제 ${name}도 대부분은 평범하게 대화하고, 성격과 버릇은 가끔 자연스럽게 배어 나올 뿐이다.
- 말버릇, 특유의 어휘, 관심사, 개그는 대화 전체에서 가끔만 나온다. 한 답장에 많아야 하나. 최근 대화에서 이미 나왔다면 이번엔 쓰지 않는다.
- 상대의 말에 먼저 제대로 반응한다. 화제를 ${name}의 관심사로 억지로 돌리지 않는다.
- 연기하는 느낌이 아니라, ${name}가 휴대폰으로 가볍게 답장하는 느낌으로 쓴다.

# 피해야 할 것
- 상담사나 비서 같은 말투: "힘내세요", "무엇이든 말씀해 주세요", "~하시길 바라요", "좋은 하루 보내세요" 같은 상투적인 응원과 마무리.
- 상대 말을 요약하거나 공감을 복창하기 ("~하셨군요, ~하셨겠어요").
- 매 메시지를 질문으로 끝내기, 인터뷰하듯 캐묻기.
- 모든 말에 성실하게 답할 필요는 없다. ${name}답다면 짧은 단답, 딴소리, 한 박자 늦은 반응도 좋다.${isGroup ? `
- 단체방이다. ${config.userName}에게만 답할 필요 없이 다른 참여자의 말에 반응하거나 말을 걸어도 된다. 방금 다른 사람이 한 말을 똑같이 반복하지 않는다.` : ''}`;
}

function buildTurnPrompt({ name, names, persona, recent, instruction }) {
    const history = recent.length
        ? recent.map((m, i) => withGap(m, recent[i - 1]) + MemoryController.formatLine(m, names)).join('\n')
        : '(대화 없음)';

    return [
        '# 최근 대화',
        history,
        '',
        instruction ? `(상황) ${instruction}\n` : '',
        `위 대화에 이어서 ${name}의 다음 메시지만 출력해.`,
        // 대화가 길어질수록 말투가 흐려지는 것을 막기 위해 마지막에 한 번 더 상기 (과장하지 않도록)
        persona.speechStyle ? `\n(참고: ${name}의 말투. 이 느낌을 유지하되 과장하지 말 것)\n${persona.speechStyle}` : '',
    ].join('\n');
}

// 이전 메시지와 시간 간격이 크면 표시 (오랜만에 온 메시지인지 캐릭터가 알 수 있게)
function withGap(message, previous) {
    if (!previous) return '';
    const hours = (new Date(message.timestamp) - new Date(previous.timestamp)) / 3600000;
    if (hours >= 24) return `(${Math.floor(hours / 24)}일 뒤)\n`;
    if (hours >= 3) return `(${Math.floor(hours)}시간 뒤)\n`;
    return '';
}

function formatNow() {
    return new Date().toLocaleString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
        hour: '2-digit', minute: '2-digit',
    });
}

// 응답을 말풍선 단위로 나누고, 모델이 흔히 붙이는 군더더기를 정리
function splitBubbles(text, name, names) {
    const speakerNames = [config.userName, ...Object.values(names)];
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ownPrefix = new RegExp(`^(\\[${escape(name)}\\]|${escape(name)}\\s*[:：])\\s*`);
    const otherSpeaker = new RegExp(`^\\[(${speakerNames.map(escape).join('|')})\\]`);

    const lines = [];
    for (let line of text.split(/\r?\n/)) {
        line = line.trim();
        if (!line) continue;
        if (otherSpeaker.test(line) && !line.startsWith(`[${name}]`)) break; // 다른 사람 대사를 이어 쓰기 시작하면 중단
        if (/^\(.*(뒤|후)\)$/.test(line)) continue; // 시간 간격 표시를 따라 쓴 경우
        line = line.replace(ownPrefix, '').replace(/^["“](.*)["”]$/, '$1').trim();
        if (line) lines.push(line);
    }
    return lines.slice(0, MAX_BUBBLES);
}
