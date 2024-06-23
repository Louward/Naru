const mongoose = require('mongoose');
const Chat = require('./Chat');

const messageSchema = new mongoose.Schema({
    chatID: {
        type: String,
        unique: true, // 각 메세지 ID는 고유해야 합니다.
        required: [true, 'ID is required'], // 메세지 ID는 필수입니다.
    },
    messages: [{
        sender: {
            type: String, // 캐릭터 ID OR 'user' 기록
            required: [true, 'Message sender is required'],
        },
        content: {
            type: String,
            required: [true, 'Message content is required'],
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    }],
});

// 메시지 저장 후, 관련 Chat 문서의 lastMessage 업데이트
messageSchema.post('save', async function () {
    const lastMessage = this.messages[this.messages.length - 1]; // 가장 최근 메시지
    await Chat.findOneAndUpdate(
        { chatID: this.chatID }, // 참조하는 Chat 문서 찾기
        {
            lastMessage: {
                sender: lastMessage.sender,
                content: lastMessage.content,
                timestamp: lastMessage.timestamp
            },
            lastActive: Date.now() // 현재 시간으로 lastActive 업데이트
        },
        { new: true } // 업데이트된 문서 반환
    );
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
