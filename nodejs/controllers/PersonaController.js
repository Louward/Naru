const fs = require('fs');
const path = require('path');

const CHARACTER_DIR = path.join(__dirname, '..', 'characters');

// 맨 위 --- 블록의 "key: value" 설정을 읽는다
function parseFrontMatter(text) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) return { meta: {}, body: text };

    const meta = {};
    for (const line of match[1].split(/\r?\n/)) {
        const kv = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
        if (kv) meta[kv[1]] = kv[2];
    }
    return { meta, body: text.slice(match[0].length) };
}

// "## 제목" 섹션 본문을 꺼낸다
function extractSection(body, title) {
    const lines = body.split(/\r?\n/);
    const start = lines.findIndex(line => new RegExp(`^##\\s*${title}\\s*$`).test(line.trim()));
    if (start === -1) return '';

    const rest = lines.slice(start + 1);
    const end = rest.findIndex(line => /^#{1,2}\s/.test(line));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

// characters/<characterID>.md 를 읽는다. 파일은 매번 새로 읽으므로 서버 재시작 없이 수정이 반영됨
exports.loadPersona = (characterID) => {
    const filePath = path.join(CHARACTER_DIR, `${characterID}.md`);
    if (!fs.existsSync(filePath)) {
        console.warn(`캐릭터 설정 파일 없음: characters/${characterID}.md (characters/_template.md 참고)`);
        return { meta: {}, body: '', speechStyle: '' };
    }

    const { meta, body } = parseFrontMatter(fs.readFileSync(filePath, 'utf8'));
    return {
        meta,
        body: body.trim(),
        speechStyle: extractSection(body, '말투'),
    };
};
