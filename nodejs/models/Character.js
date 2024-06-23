const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
    characterID: {
        type: String,
        unique: true, // 각 캐릭터 ID는 고유해야 합니다.
        required: [true, 'Character ID is required'], // 캐릭터 ID는 필수입니다.
    },
    characterName: {
        type: String,
        required: [true, 'Character name is required'], // 캐릭터 이름은 필수입니다.
    },
    characterImage: String, // 이미지 경로는 선택 사항입니다.
    characterPersonality: String, // 캐릭터 성격은 선택 사항입니다.
});


const Character = mongoose.model('Character', characterSchema);

module.exports = Character;
