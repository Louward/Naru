const fs = require('fs');
const path = require('path');

const CHARACTER_DIR = path.join(__dirname, '..', 'characters');

// 맨 위 --- 블록의 "key: value" 설정을 읽는다 (# 으로 시작하는 줄은 주석)
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

// "6-23" → { start: 6, end: 23 } (end가 24를 넘으면 다음날 새벽까지)
function parseHours(value) {
    const match = (value || '').match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    return match ? { start: Number(match[1]), end: Number(match[2]) } : null;
}

// characters/<characterID>.md 를 읽는다. 파일은 매번 새로 읽으므로 서버 재시작 없이 수정이 반영됨
exports.loadPersona = (characterID) => {
    const filePath = path.join(CHARACTER_DIR, `${characterID}.md`);
    if (!fs.existsSync(filePath)) {
        return { exists: false, meta: {}, body: '', name: '', speechStyle: '', aliases: [], activeHours: null, proactive: false };
    }

    const { meta, body } = parseFrontMatter(fs.readFileSync(filePath, 'utf8'));
    return {
        exists: true,
        meta,
        body: body.trim(),
        name: meta.name || (body.match(/^#\s+(.+)$/m) || [])[1]?.trim() || characterID,
        speechStyle: extractSection(body, '말투'),
        aliases: (meta.aliases || '').split(',').map(s => s.trim()).filter(Boolean),
        activeHours: parseHours(meta.active_hours),
        proactive: meta.proactive !== 'false',
    };
};

// 모든 캐릭터가 공유하는 세계관 (characters/_world.md)
exports.loadWorld = () => {
    const filePath = path.join(CHARACTER_DIR, '_world.md');
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
};

// 캐릭터 파일 목록 (_로 시작하는 파일 제외)
exports.listCharacterIDs = () => fs.readdirSync(CHARACTER_DIR)
    .filter(file => file.endsWith('.md') && !file.startsWith('_'))
    .map(file => path.basename(file, '.md'));

// 단체방 정의 (characters/_rooms.json)
exports.loadRooms = () => {
    const filePath = path.join(CHARACTER_DIR, '_rooms.json');
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
};
