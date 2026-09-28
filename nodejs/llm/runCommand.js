const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// CLI는 빈 작업 폴더에서 실행 (프로젝트 파일이나 CLAUDE.md 등을 읽지 않도록)
const WORK_DIR = path.join(os.tmpdir(), 'naru-llm');
fs.mkdirSync(WORK_DIR, { recursive: true });

// Windows에서 npm으로 설치한 CLI(.cmd)는 shell을 거쳐야 실행되므로 인자를 직접 따옴표 처리
function quoteForWindows(arg) {
    if (arg !== '' && !/[\s"&|<>^()]/.test(arg)) return arg;
    return `"${arg.replace(/"/g, '\\"')}"`;
}

// 명령을 실행하고 stdin으로 input을 넘긴 뒤 stdout을 돌려준다
function runCommand(command, args, { input = '', timeoutMs = 180000 } = {}) {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        const child = spawn(
            command,
            isWindows ? args.map(quoteForWindows) : args,
            { cwd: WORK_DIR, shell: isWindows, windowsHide: true }
        );

        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`${command} 응답 시간 초과 (${timeoutMs}ms)`));
        }, timeoutMs);

        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', err => {
            clearTimeout(timer);
            reject(new Error(`${command} 실행 실패: ${err.message} (설치되어 있고 PATH에 있는지 확인하세요)`));
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (code === 0) resolve(stdout);
            else reject(new Error(`${command} 종료 코드 ${code}: ${(stderr || stdout).trim().slice(0, 500)}`));
        });

        child.stdin.end(input);
    });
}

// 임시 파일 경로 생성
function tempFile(name) {
    return path.join(WORK_DIR, `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`);
}

module.exports = { runCommand, tempFile, WORK_DIR };
