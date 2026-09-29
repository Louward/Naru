const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    chatID: {
        type: String,
        unique: true,
        required: [true, 'ID is required'], // 메세지 ID는 필수입니다.
    },
    roomType: {
        type: String,
        required: true,
        enum: ['personal', 'group']
    },
    name: String,
    image: String,
    characters: [{
        type: String, // // 메시지와 연관된 캐릭터 ID 기록
    }],
    lastMessage: {
        sender: String,
        content: String,
        timestamp: Date
    },
    // 오래된 대화를 요약해 둔 장기 기억
    memory: {
        summary: { type: String, default: '' },
        summarizedCount: { type: Number, default: 0 }, // 요약에 반영된 메시지 수 (앞에서부터)
        updatedAt: Date
    },
    lastProactiveAt: Date, // 캐릭터가 마지막으로 먼저 연락한 시각
    userReadAt: Date, // 사용자가 마지막으로 이 방을 읽은 시각 (안 읽은 메시지 수 계산용)
    lastActive: {
        type: Date,
        default: Date.now
    },
});


const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
