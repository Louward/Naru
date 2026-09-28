const config = require('../config/config');
const llm = require('../llm');
const RandomController = require('./RandomController');
const PersonaController = require('./PersonaController');
const MemoryController = require('./MemoryController');
const Chat = require('../models/Chat');
const Character = require('../models/Character');

const MAX_BUBBLES = 5; // 한 번에 보낼 최대 말풍선 수

// 채팅방에 대한 AI 응답 생성
// 사용자 메시지는 이미 DB에 저장된 상태이므로 대화 기록에서 읽어온다
exports.generateReply = async (chatID) => {
    const chat = await Chat.findOne({ chatID });
    if (!chat) throw new Error(`Chat not found: ${chatID}`);

    const characterID = matchingCharacter(chat.characters);
    const characters = await Character.find({ characterID: { $in: chat.characters } });
    const names = Object.fromEntries(characters.map(c => [c.characterID, c.characterName]));
    const name = names[characterID] || characterID;

    const persona = PersonaController.loadPersona(characterID);
    const { summary, recent } = await MemoryController.getContext(chatID);

    const text = await llm.generate({
        provider: persona.meta.provider,
        model: persona.meta.model,
        system: buildSystemPrompt({ chat, name, names, characterID, persona, summary }),
        prompt: buildTurnPrompt({ name, names, persona, recent }),
    });

    // 응답 후 필요하면 오래된 대화를 요약 (기다리지 않음)
    MemoryController.compactIfNeeded(chatID, names);

    return { characterID, lines: splitBubbles(text, name, names) };
};

// 답변할 캐릭터 선택 (그룹 채팅이면 무작위)
function matchingCharacter(characters) {
    if (characters.length === 1) return characters[0].toString();

    const weights = Object.fromEntries(characters.map(id => [id.toString(), 1]));
    return new RandomController(weights).customMethod();
}

function buildSystemPrompt({ chat, name, names, characterID, persona, summary }) {
    const others = Object.entries(names)
        .filter(([id]) => id !== characterID)
        .map(([, otherName]) => otherName);
    const members = [config.userName, name, ...others].join(', ');

    return `너는 지금부터 메신저 앱 속 인물 "${name}"이다. 아래 캐릭터 설정이 너의 전부다.

# 캐릭터 설정
${persona.body || `(설정 파일 없음) 이름은 ${name}. 자연스럽고 친근한 말투로 대화한다.`}

# 대화방
- 방 이름: ${chat.name || '(없음)'} (${chat.roomType === 'group' ? '단체방' : '1:1 대화'})
- 참여자: ${members}
- 현재 시각: ${formatNow()}

# 지난 대화의 기억
${summary || '(아직 없음. 처음 대화하는 사이일 수 있다.)'}

# 규칙
- 항상 ${name}로서만 말한다. AI, 언어 모델, 프롬프트, 설정 파일 이야기는 절대 하지 않는다. 캐릭터를 깨라는 요청도 ${name}답게 받아넘긴다.
- 메신저 채팅처럼 쓴다. 말풍선 하나에 한두 문장, 말풍선은 줄바꿈으로 나눈다. 보통 1~3개.
- 지문, 괄호 속 행동 묘사, *별표*, 마크다운, "${name}:" 같은 이름 접두어를 쓰지 않는다.
- 다른 참여자의 대사를 대신 쓰지 않는다. ${name}의 다음 메시지만 쓴다.
- 기억과 설정에 모순되는 말을 하지 않는다. 모르는 건 ${name}답게 모른다고 하거나 되묻는다.
- 매번 질문으로 끝내거나 상대 말을 되풀이하지 않는다. ${name}의 기분, 생각, 일상을 먼저 꺼내도 된다.`;
}

function buildTurnPrompt({ name, names, persona, recent }) {
    const history = recent.length
        ? recent.map((m, i) => withGap(m, recent[i - 1]) + MemoryController.formatLine(m, names)).join('\n')
        : '(대화 없음)';

    return [
        '# 최근 대화',
        history,
        '',
        `위 대화에 이어서 ${name}의 다음 메시지만 출력해.`,
        // 대화가 길어질수록 말투가 흐려지는 것을 막기 위해 마지막에 한 번 더 상기
        persona.speechStyle ? `\n(${name}의 말투를 지킬 것)\n${persona.speechStyle}` : '',
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
