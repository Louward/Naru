const mongoose = require('mongoose');
const Chat = require('./Chat');

const messageSchema = new mongoose.Schema({
    chatID: {
        type: String,
        unique: true, // �� �޼��� ID�� �����ؾ� �մϴ�.
        required: [true, 'ID is required'], // �޼��� ID�� �ʼ��Դϴ�.
    },
    messages: [{
        sender: {
            type: String, // ĳ���� ID OR 'user' ���
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

// �޽��� ���� ��, ���� Chat ������ lastMessage ������Ʈ
messageSchema.post('save', async function () {
    const lastMessage = this.messages[this.messages.length - 1]; // ���� �ֱ� �޽���
    await Chat.findOneAndUpdate(
        { chatID: this.chatID }, // �����ϴ� Chat ���� ã��
        {
            lastMessage: {
                sender: lastMessage.sender,
                content: lastMessage.content,
                timestamp: lastMessage.timestamp
            },
            lastActive: Date.now() // ���� �ð����� lastActive ������Ʈ
        },
        { new: true } // ������Ʈ�� ���� ��ȯ
    );
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
