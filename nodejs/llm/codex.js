const fs = require('fs');
const config = require('../config/config');
const { runCommand, tempFile } = require('./runCommand');

// Codex CLI(ChatGPT 로그인) 호출
// codex exec에는 시스템 프롬프트 옵션이 없어서 캐릭터 설정을 프롬프트 앞에 붙인다
module.exports = async function generateWithCodex({ system, prompt, model }) {
    const { command, reasoningEffort } = config.llm.codex;
    const outputFile = tempFile('codex-output.txt');

    const args = [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '--sandbox', 'read-only',
        '--color', 'never',
        '-o', outputFile,
    ];
    const selectedModel = model || config.llm.codex.model;
    if (selectedModel) args.push('-m', selectedModel);
    // 따옴표 없이 넘겨도 codex가 문자열로 해석함 (Windows shell 따옴표 문제 회피)
    if (reasoningEffort) args.push('-c', `model_reasoning_effort=${reasoningEffort}`);
    args.push('-');

    const input = [
        '아래 지시에 따라 대화 텍스트만 출력해. 파일을 읽거나 명령을 실행하지 마.',
        '',
        '<instructions>',
        system,
        '</instructions>',
        '',
        prompt,
    ].join('\n');

    try {
        await runCommand(command, args, { input, timeoutMs: config.llm.timeoutMs });
        return fs.readFileSync(outputFile, 'utf8');
    } finally {
        fs.rm(outputFile, { force: true }, () => {});
    }
};
