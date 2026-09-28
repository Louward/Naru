const cron = require('node-cron');
const config = require('../config/config');
const PersonaController = require('../controllers/PersonaController');
const ReplyService = require('./ReplyService');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// 오늘 캐릭터별로 먼저 연락한 횟수 { 'YYYY-MM-DD': { characterID: count } }
let sentToday = {};

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

// active_hours: 6-23 → 6시~23시, 10-26 → 10시~다음날 2시
function isActiveNow(activeHours) {
    if (!activeHours) return true;
    const hour = new Date().getHours();
    const { start, end } = activeHours;
    return (hour >= start && hour < end) || (end > 24 && hour < end - 24);
}

function countToday(characterID) {
    return sentToday[today()]?.[characterID] || 0;
}

function markSent(characterID) {
    const key = today();
    sentToday = { [key]: { ...(sentToday[key] || {}), [characterID]: countToday(characterID) + 1 } };
}

// 지금 먼저 연락할 수 있는 캐릭터인지
function canReachOut(characterID) {
    const persona = PersonaController.loadPersona(characterID);
    return persona.exists && persona.proactive && isActiveNow(persona.activeHours)
        && countToday(characterID) < config.proactive.maxPerDay;
}

async function lastUserMessageTime(chatID) {
    const messageDoc = await Message.findOne({ chatID });
    const messages = messageDoc?.messages || [];
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].sender === 'user') return new Date(messages[i].timestamp);
    }
    return new Date(0);
}

function describeGap(hours) {
    if (hours >= 48) return `${Math.floor(hours / 24)}일`;
    if (hours >= 1) return `${Math.floor(hours)}시간`;
    return '잠시';
}

async function tick() {
    const { minGapHours, chance } = config.proactive;
    const chats = await Chat.find({});

    for (const chat of chats) {
        if (ReplyService.isBusy(chat.chatID)) continue;
        if (Math.random() >= chance) continue;

        const gapHours = (Date.now() - new Date(chat.lastActive || 0).getTime()) / 3600000;
        if (gapHours < minGapHours) continue;

        // 지휘관이 답하지 않은 선톡이 이미 있으면 연달아 보내지 않음
        if (chat.lastProactiveAt && chat.lastProactiveAt > await lastUserMessageTime(chat.chatID)) continue;

        const candidates = chat.characters.map(String).filter(canReachOut);
        if (candidates.length === 0) continue;

        const characterID = candidates[Math.floor(Math.random() * candidates.length)];
        const name = PersonaController.loadPersona(characterID).name;
        console.log(`[먼저 연락] ${name} → ${chat.name}`);
        markSent(characterID);
        await Chat.updateOne({ chatID: chat.chatID }, { lastProactiveAt: new Date() });

        const instruction = chat.lastMessage
            ? `${config.userName}에게서 ${describeGap(gapHours)} 동안 연락이 없었다. ${name}가 먼저 블라블라를 보낸다. 지금 시각과 ${name}의 일상에 어울리는 자연스러운 계기로 짧게 보낸다. 지난 화제를 이어가도 되고 새 이야기를 꺼내도 된다.`
            : `아직 아무 대화도 없는 방이다. ${name}가 먼저 블라블라를 보낸다. ${name}다운 첫 메시지를 짧게 보낸다.`;

        // 한 번에 한 방씩만 (여러 방에서 동시에 연락이 오면 부자연스러움)
        await ReplyService.respond(chat.chatID, { first: characterID, instruction });
        return;
    }
}

exports.start = () => {
    if (!config.proactive.enabled) {
        console.log('먼저 연락하기: 꺼짐');
        return;
    }

    cron.schedule('*/20 * * * *', () => {
        tick().catch(error => console.error('먼저 연락하기 실패:', error.message));
    });
    console.log(`먼저 연락하기: 켜짐 (캐릭터당 하루 최대 ${config.proactive.maxPerDay}회)`);
};

exports.tick = tick; // 테스트용
