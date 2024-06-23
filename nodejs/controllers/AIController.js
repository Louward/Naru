const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const RandomController = require('./RandomController');

// 캐릭터별 스레드 정보를 관리하는 객체
let chatThreads = {};

// 스레드 생성 처리 로직
exports.handleEnter = async (req, res) => {
    try {
        const chatID = req.body.chatID;
        if (!chatThreads[chatID]) {
            const thread = await openai.beta.threads.create();
            console.log(`[${chatID} 대화방 접속, 스레드 생성]  ${thread.id}`);
            chatThreads[chatID] = thread.id;
        } else {
            console.log(`[${chatID} 대화방 접속]`);
        }
        res.json({});
    } catch (error) {
        console.error('채팅방 이동 처리 중 오류 발생:', error);
        res.status(500).json({ error: "요청 처리 중 오류 발생" });
    }
};

// AI에게 메시지 전송 처리 로직
exports.sendMessageToAI = async (chatID, characters, message) => {
    try {
        // 스레드 메시지 추가
        const threadId = chatThreads[chatID]; // 스레드 불러오기
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: message
        });

        // AI 매칭
        const characterID = await matchingAssistant(characters);
        const assistantId = getAssistantId(characterID);

        // 답변 실행 및 AI 응답 처리
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId,
            instructions: ""
        });

        return {
            threadId: threadId,
            characterID: characterID,
            run: run.id
        };
    } catch (error) {
        console.error('AI에게 메시지 전송 처리 중 오류 발생:', error);
        throw error;
    }
};

// 캐릭터 선택 로직 구현
async function matchingAssistant(characters) {
    // 입력된 characters가 배열이 아니라면 바로 반환
    if (!Array.isArray(characters)) {
        return characters.toString();  // 문자열로 변환
    }

    // characters 배열을 이용하여 확률 객체 생성
    const charlist = characters.reduce((acc, characterID) => {
        acc[characterID.toString()] = 1;  // 문자열로 변환하여 균등한 가중치 부여
        return acc;
    }, {});

    // RandomController 인스턴스 생성 및 customMethod 호출
    const random = new RandomController(charlist);
    const selectedCharacterID = random.customMethod();

    return selectedCharacterID.toString();  // 문자열로 변환하여 반환
}

// AI 응답 받아오기
exports.getAIResponse = async (threadId, runId) => {
    const runStatus = await waitForAIResponse(threadId, runId);

    if (runStatus) {
        const messages = await openai.beta.threads.messages.list(threadId);
        return messages.data[0].content[0].text.value
    }
}

// AI 응답 대기 함수
async function waitForAIResponse(threadId, runId) {
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
    if (runStatus.status === 'completed') {
        return true;
    } else if (runStatus.status === 'failed') {
        throw new Error('AI 응답 실패');
    } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return waitForAIResponse(threadId, runId); // 재귀 호출
    }
}

// threads 정리
exports.cleanupThreads = async () => {
    console.log('[ 실행중인 스레드 종료 ]');
    for (const chatID in chatThreads) {
        const threadId = chatThreads[chatID];

        try {
            await openai.beta.threads.del(threadId);
            console.log(`${chatID} 스레드 제거: ${threadId}`);
        } catch (error) {
            console.error('스레드 종료중 오류 발생:', error);
        }
    }
}

const fs = require('fs');

const Chat = require('../models/Chat');
const Message = require('../models/Message');

// openAI 정리
exports.updateOpenAI = async () => {
    for (const chatID in chatThreads) {
        console.log(`[ ${chatID} 업데이트 ]`);
        try {
            // 파일 변환
            const filePath = await exportMessagesToCSV(chatID);

            let fileId = null;
            // 파일 업로드
            if (filePath) {
                fileId = await uploadFileToOpenAI(filePath);
            }

            // 이전파일 제거 및 업데이트
            if (fileId) {
                // 이전 파일 id 기록 및 삭제
                const files = await openai.files.list();
                const fileName = `${chatID}_${process.env.LOG_FILENAME}`;
                for (const file of files.data) {
                    if (file.filename === fileName && file.id !== fileId) {
                        await openai.files.del(file.id);
                        console.log(`이전 파일 ${file.id} 삭제`);
                    }
                }

                await updateAssistantWithFile(chatID, fileId);
            }
        } catch (error) {
            console.error('AI 정리중 오류 발생:', error);
        }
    }
}

// 대화 내용을 CSV 파일로 변환하는 함수
async function exportMessagesToCSV(chatID) {
    const messages = await Message.findOne({ chatID }).select('messages -_id');
    if (!messages || messages.messages.length === 0) {
        console.error('No messages found for chatID:', chatID);
        return;
    }

    // CSV 파일 헤더 설정
    let csvContent = 'Sender,Content,Timestamp\n';

    // 각 메시지에 대한 정보를 CSV 형태로 변환
    messages.messages.forEach(message => {
        const { sender, content, timestamp } = message;
        const formattedContent = content.replace(/"/g, '""'); // 메시지 내용에서 큰따옴표(")를 이스케이프 처리 (" -> "")
        csvContent += `${sender},"${formattedContent}",${timestamp.toISOString()}\n`;
    });

    // CSV 파일명 지정 및 쓰기
    const fileName = `${chatID}_${process.env.LOG_FILENAME}`;
    fs.writeFileSync(fileName, csvContent); // 저장 경로 변경 시 해당 위치 수정
    console.log('CSV 대화 파일 생성: ', fileName);
    return fileName; // 생성된 파일명 반환
}

// OpenAI에 파일을 업로드하는 함수
async function uploadFileToOpenAI(filePath) {
    try {
        const file = await openai.files.create({
            file: fs.createReadStream(filePath),
            purpose: "assistants",
        });
        console.log('파일 업로드 성공: ', file.id);
        return file.id;
    } catch (error) {
        console.error('Failed to upload file:', error);
    }
}

// AI 어시스턴트를 업데이트하는 함수
async function updateAssistantWithFile(chatID, fileId) {
    const chat = await Chat.findOne({ chatID: chatID });

    for (const characterID of chat.characters) {
        // character 조회할 위치

        const asstID = getAssistantId(characterID);
        await openai.beta.assistants.update(
            asstID,
            {
                // 기본 배경 설정 파일은 모두에게 공통 업로드 해야함
                // characterID를 통해 character DB에 필수 보존 파일(캐릭터 설정)을 받아와서 함께 저장하도록 동작
                file_ids: [fileId]  // 이전에 업로드한 파일 ID와 다른 필요한 파일 ID를 여기에 포함
            }
        );
        console.log(`${characterID}에 파일 업데이트: ${fileId}`);
    }
}

// AI ID 매칭
function getAssistantId(characterID) {
    if (typeof characterID !== 'string') {
        throw new TypeError(`Expected characterID to be a string, but got ${typeof characterID}`);
    }

    const envVarName = `ASSISTANTS_ID_${characterID.toUpperCase()}`;
    return process.env[envVarName];
}