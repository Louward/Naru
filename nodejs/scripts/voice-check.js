// 캐릭터 말투 점검 (npm run voice-check [-- snow_white rapunzel] [--conversation])
// DB 없이 캐릭터마다 여러 상황의 메시지를 보내 보고, 답장과 지표를 출력한다.
// 기본: 메시지마다 새 대화 (메시지 하나에 대한 반응을 봄)
// --conversation: 메시지들을 한 대화로 이어서 보냄 (입버릇 반복, 같은 표현 되풀이 등 실제 대화에 가까운 빈도를 봄)
// 설정 파일(characters/*.md)을 고친 뒤 전후를 비교할 때 쓴다. 같은 모델로 비교해야 의미가 있다.
// 실제 AI를 호출하므로 캐릭터당 12번씩 구독 사용량을 쓴다.
require('dotenv').config();
const Chat = require('../models/Chat');
const Character = require('../models/Character');
const Message = require('../models/Message');
const CharacterMemory = require('../models/CharacterMemory');
const PersonaController = require('../controllers/PersonaController');
const AIController = require('../controllers/AIController');

// 평범한 말, 무성의한 말, 억울한 누명, 무례한 말을 골고루
const PROMPTS = [
    '뭐 해?', '오늘 좀 피곤하다', '나 오늘 상사한테 엄청 깨졌어', 'ㅋㅋㅋㅋ', '응',
    '너 요즘 나한테 좀 소홀한 거 아냐?', '야 너 진짜 짜증나', '오늘 저녁 뭐 먹지', '비 온다',
    '나 내일 휴가야', '너 어제 약속 까먹었지?', '잘 자',
];
// 챗봇 같은 상투 표현
const STOCK_PHRASES = ['힘내', '고생 많', '고생하셨', '푹 쉬', '괜찮을 거', '걱정 마', '언제든', '무슨 일 있으면', '응원', '잘하고 있', '곁에', '함께할게', '토닥', '편히 쉬'];

const args = process.argv.slice(2);
const conversationMode = args.includes('--conversation');
const named = args.filter(a => !a.startsWith('--'));
const ids = named.length ? named : PersonaController.listCharacterIDs();
const personas = Object.fromEntries(ids.map(id => [id, PersonaController.loadPersona(id)]));

// DB 대신 메모리에서 대화 기록을 돌려준다
let current = null;
Chat.findOne = async () => current.chat;
Chat.find = async () => [];
Character.find = async () => ids.map(id => ({ characterID: id, characterName: personas[id].name }));
Message.findOne = async () => ({ messages: current.messages });
CharacterMemory.findOne = async () => null;

function startConversation(id) {
    const now = Date.now();
    current = {
        chat: { chatID: `check_${id}`, name: personas[id].name, roomType: 'personal', characters: [id], memory: {} },
        messages: [
            { sender: 'user', content: '오늘 날씨 좋다', timestamp: new Date(now - 3600e3) },
            { sender: id, content: '그러게', timestamp: new Date(now - 3590e3) },
        ],
    };
}

async function reply(id, text) {
    if (!conversationMode || !current || current.chat.chatID !== `check_${id}`) startConversation(id);
    current.messages.push({ sender: 'user', content: text, timestamp: new Date() });
    const result = await AIController.generateReply(current.chat.chatID, id);
    // 대화 모드에서는 답장을 기록에 남겨 다음 턴에 이어지게 한다
    for (const line of result.lines) current.messages.push({ sender: id, content: line, timestamp: new Date() });
    return result.lines;
}

async function main() {
    for (const id of ids) {
        const rows = [];
        for (const text of PROMPTS) {
            try {
                rows.push({ text, lines: await reply(id, text) });
            } catch (error) {
                rows.push({ text, lines: [`<오류: ${error.message}>`] });
            }
        }

        const bubbles = rows.flatMap(r => r.lines);
        const count = (predicate) => rows.filter(predicate).length;
        const tics = personas[id].tics;
        console.log(`\n### ${personas[id].name}${conversationMode ? ' (한 대화로 이어서)' : ''}`);
        console.log(`- 답장당 말풍선 ${(bubbles.length / rows.length).toFixed(1)}개, 답장당 ${Math.round(bubbles.join('').length / rows.length)}자`);
        console.log(`- 질문으로 끝남 ${count(r => /[?？]$/.test(r.lines.at(-1) || ''))}/${rows.length}`);
        console.log(`- 짧은 말풍선(6자 이하) ${Math.round(bubbles.filter(b => b.replace(/\s/g, '').length <= 6).length / bubbles.length * 100)}%`);
        console.log(`- 상투 표현 ${bubbles.filter(b => STOCK_PHRASES.some(s => b.includes(s))).length}개`);
        if (tics.length) console.log(`- 입버릇(${tics.join(', ')}) 들어간 답장 ${count(r => tics.some(t => r.lines.join(' ').includes(t)))}/${rows.length}`);
        console.log('');
        for (const r of rows) console.log(`  ${r.text} → ${r.lines.join(' / ')}`);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
