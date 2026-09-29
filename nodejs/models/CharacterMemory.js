const mongoose = require('mongoose');

// 캐릭터 단위 장기 기억 (모든 대화방에서 공유)
const characterMemorySchema = new mongoose.Schema({
    characterID: { type: String, unique: true, required: true },
    summary: { type: String, default: '' },
    updatedAt: Date,
});

module.exports = mongoose.model('CharacterMemory', characterMemorySchema);
