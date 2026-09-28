# Naru

AI 캐릭터들과 메신저처럼 대화하는 웹앱입니다. 1:1 대화방과 단체방을 지원합니다.

AI 호출은 API 키 없이 **내 PC에 로그인된 CLI**를 사용합니다.

| provider | 필요한 것 | 특징 |
|---|---|---|
| `claude` | [Claude Code](https://claude.com/claude-code) 설치 후 로그인 | 캐릭터 연기 품질이 가장 좋음. Claude 구독 사용량을 씀 |
| `codex` | [Codex CLI](https://github.com/openai/codex) 설치 후 로그인 | ChatGPT 구독 사용량을 씀 |
| `ollama` | [Ollama](https://ollama.com) 설치 후 모델 받기 | 완전 무료. 품질은 모델과 그래픽카드 성능에 따라 다름 |

> CLI를 쓰는 방식은 **내 PC에서 나 혼자 쓰는 용도**로만 사용하세요. 이 앱에는 로그인 기능이 없어서, 인터넷에 공개하면 누구나 내 구독 사용량을 쓸 수 있습니다. 밖에서 폰으로 접속하고 싶다면 포트포워딩 대신 [Tailscale](https://tailscale.com) 같은 사설 VPN을 추천합니다.

## 실행 방법

```bash
cd nodejs
npm install
cp .env.example .env     # Windows: copy .env.example .env
# .env 에서 DB 주소와 LLM_PROVIDER 설정
npm run sync             # characters/*.md 를 DB에 반영 (대화방도 자동 생성)
npm start
```

브라우저에서 `http://localhost:3000` 을 열면 됩니다.
같은 와이파이의 폰에서는 `http://<PC 내부 IP>:3000` 으로 접속합니다. Windows 방화벽에서 3000번 포트를 허용해야 할 수 있습니다.

### DB

MongoDB가 필요합니다. `.env` 의 `MONGODB_URI` 에 주소를 넣으세요.

- 기존 MongoDB Atlas 클러스터: 오래 안 쓰면 일시정지될 수 있습니다. Atlas 콘솔에서 다시 켜주세요.
- PC에 설치한 MongoDB: `MONGODB_URI=mongodb://127.0.0.1:27017/naru`

## 캐릭터 만들기

캐릭터 하나는 `nodejs/characters/<characterID>.md` 파일 하나입니다.

1. `characters/_template.md` 를 복사해서 `1001.md` 처럼 저장합니다. `_example.md` 에 작성 예시가 있습니다.
2. 프로필 이미지를 `public/images/character/char1001.png` 에 넣습니다.
3. `npm run sync` 를 실행하면 캐릭터와 1:1 대화방이 DB에 만들어집니다.

설정 내용을 고치면 서버를 다시 켜지 않아도 다음 답변부터 반영됩니다. 이름, 이미지, 답장 속도를 바꿨을 때만 `npm run sync` 를 다시 실행하세요.

### 캐릭터성을 살리는 팁

- **예시 대화가 가장 중요합니다.** 성격 설명을 길게 쓰는 것보다 실제로 보낼 법한 메시지 몇 줄이 말투를 훨씬 잘 잡아줍니다.
- 성격은 형용사("츤데레")보다 행동("걱정되면 오히려 퉁명스럽게 말함")으로 쓰세요.
- `## 말투` 섹션은 매 답변 직전에 한 번 더 상기시킵니다. 대화가 길어져도 말투가 흐려지지 않도록 짧고 구체적으로 쓰세요.
- 캐릭터별로 다른 AI를 쓸 수 있습니다. 파일 맨 위의 `provider:` / `model:` 에 적으면 됩니다.

## 기억 (대화 요약)

대화가 길어지면 오래된 메시지를 요약해서 대화방의 장기 기억으로 저장합니다.

- 요약되지 않은 메시지가 `MEMORY_COMPACT_THRESHOLD`(기본 40개)를 넘으면, 최근 `MEMORY_KEEP_RECENT`(기본 20개)만 원문으로 남기고 나머지를 요약에 합칩니다.
- 요약에는 사용자에 대해 알게 된 사실, 관계, 있었던 일, 약속, 기억할 만한 말이 정리됩니다.
- 요약은 답변을 보낸 뒤 백그라운드에서 진행됩니다. 구독 사용량을 아끼려면 `SUMMARY_PROVIDER=ollama` 로 요약만 로컬 모델에 맡길 수 있습니다.

## 참고

- CLI를 실행할 때마다 프로그램이 새로 뜨기 때문에 답변 하나에 보통 5~20초 걸립니다.
- Claude는 모든 도구(파일 읽기, 명령 실행 등)를 끈 상태로, Codex는 읽기 전용 샌드박스로 빈 임시 폴더에서 실행합니다.
