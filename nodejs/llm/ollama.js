const config = require('../config/config');

// 로컬 Ollama 서버 호출 (완전 무료, 사용량 제한 없음)
module.exports = async function generateWithOllama({ system, prompt, model }) {
    const { host, numCtx } = config.llm.ollama;
    const selectedModel = model || config.llm.ollama.model;

    const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(config.llm.timeoutMs),
        body: JSON.stringify({
            model: selectedModel,
            stream: false,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
            ],
            // 기본 컨텍스트(2048~4096)는 캐릭터 설정 + 대화 기록을 넣기에 너무 작음
            options: { num_ctx: numCtx },
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama 오류 ${response.status}: ${text.slice(0, 300)} (모델 "${selectedModel}"이 ollama list에 있는지 확인하세요)`);
    }

    const data = await response.json();
    return data.message?.content || '';
};
