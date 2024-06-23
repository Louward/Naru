const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
    characterID: {
        type: String,
        unique: true, // �� ĳ���� ID�� �����ؾ� �մϴ�.
        required: [true, 'Character ID is required'], // ĳ���� ID�� �ʼ��Դϴ�.
    },
    characterName: {
        type: String,
        required: [true, 'Character name is required'], // ĳ���� �̸��� �ʼ��Դϴ�.
    },
    characterImage: String, // �̹��� ��δ� ���� �����Դϴ�.
    characterPersonality: String, // ĳ���� ������ ���� �����Դϴ�.
});


const Character = mongoose.model('Character', characterSchema);

module.exports = Character;
