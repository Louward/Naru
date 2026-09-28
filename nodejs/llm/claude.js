const fs = require('fs');
const config = require('../config/config');
const { runCommand, tempFile } = require('./runCommand');

// Claude Code CLI(구독 로그인) 호출
// - 시스템 프롬프트를 통째로 교체해서 코딩 에이전트 성격을 빼고
// - 모든 도구와 MCP를 꺼서 채팅 입력으로 명령이 실행되지 않게 함
module.exports = async function generateWithClaude({ system, prompt, model }) {
    const { command } = config.llm.claude;
    const systemFile = tempFile('system.txt');
    fs.writeFileSync(systemFile, system, 'utf8');

    const args = [
        '-p',
        '--output-format', 'json',
        '--system-prompt-file', systemFile,
        '--tools', '',
        '--strict-mcp-config',
        '--no-session-persistence',
    ];
    const selectedModel = model || config.llm.claude.model;
    if (selectedModel) args.push('--model', selectedModel);

    try {
        const stdout = await runCommand(command, args, { input: prompt, timeoutMs: config.llm.timeoutMs });
        const result = JSON.parse(stdout);
        if (result.is_error) throw new Error(`Claude 오류: ${result.result || result.subtype}`);
        return result.result || '';
    } finally {
        fs.rm(systemFile, { force: true }, () => {});
    }
};
