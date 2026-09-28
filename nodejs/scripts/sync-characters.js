// characters 폴더의 설정을 DB에 반영하는 스크립트 (npm run sync)
// - <characterID>.md 마다 Character 문서를 만들거나 갱신
// - 1:1 대화방이 없는 캐릭터는 대화방을 새로 만듦 (chatID = "c_<characterID>")
// - _rooms.json 에 적힌 단체방을 만들거나 갱신
// 기존 대화 기록과 기억은 건드리지 않습니다.
require('dotenv').config();
const mongoose = require('mongoose');
require('../config/MongoDB');
const Character = require('../models/Character');
const Chat = require('../models/Chat');
const { loadPersona, listCharacterIDs, loadRooms } = require('../controllers/PersonaController');

// 프로필 이미지 기본 경로. public/images/nikke 폴더는 git에 올라가지 않음
const defaultImage = id => `/images/nikke/${id}.png`;

async function main() {
    await mongoose.connection.asPromise();

    const ids = listCharacterIDs();
    if (ids.length === 0) {
        console.log('characters 폴더에 캐릭터 파일이 없습니다. _template.md를 복사해서 <characterID>.md로 만들어 주세요.');
    }

    for (const characterID of ids) {
        const persona = loadPersona(characterID);
        const image = persona.meta.image || defaultImage(characterID);

        await Character.updateOne(
            { characterID },
            { characterName: persona.name, characterImage: image, characterPersonality: persona.meta.speed || 'fast' },
            { upsert: true }
        );

        const existing = await Chat.findOne({ roomType: 'personal', characters: [characterID] });
        if (!existing) {
            await Chat.create({ chatID: `c_${characterID}`, roomType: 'personal', name: persona.name, image, characters: [characterID] });
            console.log(`+ 1:1 대화방 생성: ${persona.name}`);
        }
        console.log(`✓ 캐릭터 ${characterID}: ${persona.name}`);
    }

    for (const room of loadRooms()) {
        const missing = room.characters.filter(id => !ids.includes(id));
        if (missing.length) console.warn(`! ${room.name}: 캐릭터 파일이 없는 멤버 ${missing.join(', ')}`);

        await Chat.updateOne(
            { chatID: room.chatID },
            {
                roomType: 'group',
                name: room.name,
                image: room.image || `/images/nikke/${room.chatID}.png`,
                characters: room.characters,
            },
            { upsert: true }
        );
        console.log(`✓ 단체방 ${room.chatID}: ${room.name} (${room.characters.length}명)`);
    }

    await mongoose.disconnect();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
