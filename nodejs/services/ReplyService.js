const AIController = require('../controllers/AIController');
const DBController = require('../controllers/DBController');
const MemoryController = require('../controllers/MemoryController');
const { broadcast } = require('../routes/broadcast');

// 답장 중인 채팅방 (한 방에서 답장이 겹치지 않도록)
const busy = new Set();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomBetween = (min, max) => min + Math.random() * (max - min);

exports.isBusy = chatID => busy.has(chatID);

// 채팅방에 캐릭터들의 답장을 보낸다
// - 사용자 메시지에 대한 답장: respond(chatID)
// - 먼저 연락하기: respond(chatID, { first: characterID, instruction })
// 흐름: (캐릭터별 대기) → 읽음 → 입력 중… → 말풍선들 → 다음 캐릭터
exports.respond = async (chatID, { first, instruction } = {}) => {
    if (busy.has(chatID)) return false;
    busy.add(chatID);

    try {
        const responders = await AIController.pickResponders(chatID, { first });

        for (const [index, characterID] of responders.entries()) {
            const character = await DBController.getCharacter(characterID);

            // 첫 번째는 캐릭터 성격에 따른 대기, 끼어드는 캐릭터는 짧게 대기
            await sleep(index === 0 ? character.personality : randomBetween(1500, 4000));
            if (index === 0 && !first) broadcast({ type: 'read', chatID });

            broadcast({ type: 'typing', chatID, characterID, name: character.name, typing: true });
            let reply;
            try {
                // 끼어드는 캐릭터에게는 먼저 연락하기 지시를 넘기지 않음
                reply = await AIController.generateReply(chatID, characterID, { instruction: index === 0 ? instruction : undefined });
            } catch (error) {
                console.error(`AI 응답 생성 실패 (${chatID}/${characterID}):`, error.message);
                continue;
            } finally {
                broadcast({ type: 'typing', chatID, characterID, typing: false });
            }

            console.log(`${character.name} : ${reply.lines.join(' / ')}`);
            for (const [lineIndex, content] of reply.lines.entries()) {
                if (lineIndex > 0) await sleep(Math.min(600 + content.length * 40, 2500)); // 글자 수에 따라 타이핑 시간
                await DBController.saveMessage(chatID, characterID, content);
                broadcast({
                    type: 'ai_response',
                    chatID,
                    message: { sender: characterID, content, timestamp: Date.now() },
                    characterInfo: { name: character.name, image: character.image },
                });
            }
        }

        // 필요하면 오래된 대화를 요약 (기다리지 않음)
        MemoryController.compactIfNeeded(chatID);
        return true;
    } catch (error) {
        console.error(`답장 처리 실패 (${chatID}):`, error.message);
        return false;
    } finally {
        busy.delete(chatID);
    }
};
