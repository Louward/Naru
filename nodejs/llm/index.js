const config = require('../config/config');

const providers = {
    claude: require('./claude'),
    codex: require('./codex'),
    ollama: require('./ollama'),
};

// provider를 골라 텍스트를 생성한다
// { system, prompt, provider?, model? } → 응답 문자열
async function generate({ system, prompt, provider, model }) {
    const name = (provider || config.llm.provider).toLowerCase();
    const run = providers[name];
    if (!run) {
        throw new Error(`알 수 없는 AI provider: ${name} (claude | codex | ollama 중 하나)`);
    }

    const startedAt = Date.now();
    const text = await run({ system, prompt, model });
    console.log(`  [${name}${model ? `/${model}` : ''}] ${((Date.now() - startedAt) / 1000).toFixed(1)}초`);

    // 추론 모델이 내놓는 <think> 블록 제거
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

module.exports = { generate };
