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
    lastActive: {
        type: Date,
        default: Date.now
    },
});


const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
