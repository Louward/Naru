const Character = require('../models/Character');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// 캐릭터 DB 조회
exports.getCharacter = async (characterID) => {
    const character = await Character.findOne({ characterID: characterID });
    if (!character) {
        throw new Error('Character not found');  // 에러를 throw 하여 처리
    }

    const time = matchingPersonality(character.personality)

    return {
        name: character.characterName,
        image: character.characterImage,
        personality: time
    };
};

// 성격에 따라 답장 대기 시간 매칭 (매번 조금씩 다르게)
function matchingPersonality(personality) {
    const between = (min, max) => Math.round(min + Math.random() * (max - min));
    switch (personality) {
        case 'slow':
            return between(20000, 90000)
        default:
            return between(1500, 5000)
    }
}

// 사용자가 채팅방을 읽음
exports.markRead = async (chatID) => {
    await Chat.updateOne({ chatID }, { userReadAt: new Date() });
};

// 안 읽은 캐릭터 메시지 수
async function countUnread(chat) {
    const messageDoc = await Message.findOne({ chatID: chat.chatID });
    const since = chat.userReadAt ? new Date(chat.userReadAt).getTime() : 0;
    return (messageDoc?.messages || [])
        .filter(m => m.sender !== 'user' && new Date(m.timestamp).getTime() > since)
        .length;
}

// 채팅방내 캐릭터 조회
exports.getCharacterForChat = async (chatID) => {
    const chat = await Chat.findOne({ chatID: chatID });
    if (!chat) {
        throw new Error('Chat not found');  // 에러를 throw 하여 처리
    }

    return {
        characters: chat.characters  // characters 배열만 반환
    };
};

// 채팅방 리스트 조회 로직
exports.handleChatroomList = async (req, res) => {
    try {
        // lastActive 기준으로 내림차순 정렬하여 채팅방 목록을 가져옵니다.
        const chats = await Chat.find({}).sort({ lastActive: -1 });

        const chatRoomDetails = await Promise.all(chats.map(async chat => ({
            chatID: chat.chatID,
            name: chat.name,
            image: chat.image,
            roomType: chat.roomType,
            memberCount: chat.characters.length,
            unread: await countUnread(chat),
            lastMessage: chat.lastMessage ? chat.lastMessage.content : '',
            lastTime: chat.lastMessage ? chat.lastMessage.timestamp : ''
        })));

        res.json(chatRoomDetails);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// 채팅방 메세지 제공 로직
exports.handleChatroomMessages = async (req, res) => {
    try {
        const chatID = req.params.chatID;
        const chat = await Chat.findOne({ chatID: chatID });
        const messageDoc = await Message.findOne({ chatID: chatID });

        if (!chat) {
            return res.status(404).send('Chatroom not found');
        }

        // 캐릭터 정보 조회
        const characterInfo = await Character.find({
            'characterID': { $in: chat.characters }
        });

        // 캐릭터 정보를 characterID를 키로 하는 객체로 변환
        const characters = {};
        characterInfo.forEach(character => {
            characters[character.characterID] = {
                name: character.characterName,
                image: character.characterImage,
            };
        });

        const messages = messageDoc ? messageDoc.messages : [];
        messages.sort((a, b) => a.timestamp - b.timestamp);

        await exports.markRead(chatID); // 방을 열면 읽음 처리

        const responseData = {
            chatname: chat.name,
            roomType: chat.roomType,
            characters: characters,
            messages: messages.map(msg => ({
                sender: msg.sender,
                content: msg.content,
                timestamp: msg.timestamp
            }))
        };

        res.json(responseData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};

// 메세지 활성화 여부 검색
exports.activeMessage = async (chatID, minutes) => {
    const ago = new Date();
    ago.setMinutes(ago.getMinutes() - minutes);

    try {
        const activeChat = await Chat.findOne({ chatID: chatID, lastActive: { $gt: ago } });
        return !!activeChat; // activeChat이 있으면 true, 없으면 false를 반환
    } catch (error) {
        console.error(error);
        return false; // 에러 발생 시 false 반환
    }
};

// 메세지 DB 저장
exports.saveMessage = async (chatID, sender, content) => {
    let messageDoc = await Message.findOne({ chatID: chatID });
    if (!messageDoc) {
        // 저장된 메세지 이력이 없으면 새로운 메세지 문서 생성
        messageDoc = new Message({ chatID: chatID, messages: [] });
    }

    // 새 메시지 정보를 messages 배열에 추가
    messageDoc.messages.push({
        sender: sender,
        content: content,
        timestamp: new Date() // 현재 시간을 타임스탬프로 사용
    });

    // 문서 저장
    await messageDoc.save();
}

////////////////////////////////////////////////임시처리이////////////////////////////////////////////////////////

//createCharacter(); // 캐릭터 데이터 생성
//createChat(); // 채팅방 데이터 생성

async function createCharacter() {
    try {
        const newCharacter = new Character({
            characterID: '1002',
            characterName: "일본어",
            characterImage: "/images/character/char1002.png",
            characterPersonality: "fast"
        });

        console.log("새 캐릭터가 성공적으로 추가되었습니다:", newCharacter.characterName);
    } catch (err) {
        console.error("캐릭터 추가 중 오류 발생:", err);
    }
}

async function createChat() {
    try {
        const newChat = new Chat({
            chatID: '101',
            roomType: "personal",
            name: "한국어",
            image: "/images/character/char1001.png",
            characters: ['1001']
        });

        console.log("새 채팅방이 성공적으로 추가되었습니다:", newChat.chatID);
    } catch (err) {
        console.error("채팅방 추가 중 오류 발생:", err);
    }
}

// 채팅방 리스트 조회 로직
async function inChat() {
    try {
        const chats = await Chat.find({});
        chats.lastMessage.push({

        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }

    await chats.save();
};