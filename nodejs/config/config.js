// 서버 설정 (값은 .env에서 덮어쓸 수 있습니다)
const num = (value, fallback) => (value !== undefined && value !== '' ? Number(value) : fallback);

const config = {
    // 대화창에서 사용자를 부를 이름
    userName: process.env.USER_NAME || '사용자',

    llm: {
        // 기본 AI: claude | codex | ollama (캐릭터 파일에서 캐릭터별로 바꿀 수 있음)
        provider: process.env.LLM_PROVIDER || 'claude',
        // 대화 요약용 AI (비워두면 기본 AI 사용)
        summaryProvider: process.env.SUMMARY_PROVIDER || '',
        timeoutMs: num(process.env.LLM_TIMEOUT_MS, 180000),

        claude: {
            command: process.env.CLAUDE_COMMAND || 'claude',
            model: process.env.CLAUDE_MODEL || '',
        },
        codex: {
            command: process.env.CODEX_COMMAND || 'codex',
            model: process.env.CODEX_MODEL || '',
            reasoningEffort: process.env.CODEX_REASONING_EFFORT || 'low',
        },
        ollama: {
            host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
            model: process.env.OLLAMA_MODEL || 'gemma3',
            numCtx: num(process.env.OLLAMA_NUM_CTX, 8192),
        },
    },

    memory: {
        // 요약되지 않은 메시지가 이 개수를 넘으면 오래된 것부터 요약
        compactThreshold: num(process.env.MEMORY_COMPACT_THRESHOLD, 40),
        // 요약 후에도 원문 그대로 남겨둘 최근 메시지 수
        keepRecent: num(process.env.MEMORY_KEEP_RECENT, 20),
        // 요약본 최대 길이(글자)
        summaryMaxChars: num(process.env.MEMORY_SUMMARY_MAX_CHARS, 2000),
    },
};

module.exports = config;
