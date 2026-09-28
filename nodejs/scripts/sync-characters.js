// characters/*.md 파일을 DB에 반영하는 스크립트 (npm run sync)
// - 파일마다 Character 문서를 만들거나 갱신
// - 1:1 대화방이 없는 캐릭터는 대화방을 새로 만듦 (chatID = "c<characterID>")
// 기존 대화 기록은 건드리지 않습니다.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('../config/MongoDB');
const Character = require('../models/Character');
const Chat = require('../models/Chat');
const { loadPersona } = require('../controllers/PersonaController');

const CHARACTER_DIR = path.join(__dirname, '..', 'characters');

async function main() {
    await mongoose.connection.asPromise();

    const files = fs.readdirSync(CHARACTER_DIR)
        .filter(file => file.endsWith('.md') && !file.startsWith('_'));

    if (files.length === 0) {
        console.log('characters 폴더에 캐릭터 파일이 없습니다. _template.md를 복사해서 <characterID>.md로 만들어 주세요.');
    }

    for (const file of files) {
        const characterID = path.basename(file, '.md');
        const { meta, body } = loadPersona(characterID);
        const name = meta.name || (body.match(/^#\s+(.+)$/m) || [])[1]?.trim() || characterID;
        const image = meta.image || `/images/character/char${characterID}.png`;

        await Character.updateOne(
            { characterID },
            { characterName: name, characterImage: image, characterPersonality: meta.speed || 'fast' },
            { upsert: true }
        );

        const existing = await Chat.findOne({ roomType: 'personal', characters: [characterID] });
        if (!existing) {
            await Chat.create({ chatID: `c${characterID}`, roomType: 'personal', name, image, characters: [characterID] });
            console.log(`+ 대화방 생성: ${name} (c${characterID})`);
        }
        console.log(`✓ ${characterID}: ${name}`);
    }

    await mongoose.disconnect();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
