# NBC KakaoTalk Bot

카카오톡 메신저 봇 API를 활용한 명령어 기반 챗봇입니다. 백엔드 서버와 HTTP 통신하여 다양한 기능을 제공합니다.

## 기능

- 명령어 기반 메시지 처리 (`!` 접두사 사용)
- 백엔드 서버와 HTTP 통신 (GET/POST 요청 지원)
- 서버 상태 확인
- 확장 가능한 명령어 시스템

## 요구사항

- [메신저봇R](https://github.com/1-Byte/android-messengerbot) 또는 호환 플랫폼
- Android 기기
- 백엔드 서버 (설정에 따라)

## 설치 방법

1. 메신저봇 앱 설치
2. 프로젝트 파일을 메신저봇 디렉토리에 복사:
   ```
   /sdcard/msgbot/Bots/nbcbot/
   ```
3. `config.json` 파일 설정:
   ```json
   {
     "serverUrl": "https://your-server-url.com",
     "timeout": 5000
   }
   ```
4. 메신저봇 앱에서 봇 활성화

## 설정

### config.json

- `serverUrl`: 백엔드 서버 URL
- `timeout`: HTTP 요청 타임아웃 (밀리초)

### bot.json

봇의 메타데이터 및 옵션 설정:
- `main`: 메인 스크립트 파일명
- `option.apiLevel`: API 레벨
- `option.useUnifiedParams`: 통합 파라미터 사용 여부
- `option.useBabel`: Babel 사용 여부

## 사용 가능한 명령어

| 명령어 | 설명 |
|--------|------|
| `!health` | 서버 상태 확인 (Ping) |
| `!help` / `!도움말` | 도움말 메시지 표시 |

## 프로젝트 구조

```
nbc-kakaotalk-bot/
├── nbcbot.js       # 메인 봇 로직
├── bot.json        # 봇 설정
├── config.json     # 서버 연결 설정
└── README.md       # 프로젝트 문서
```

## 개발

### 새로운 명령어 추가하기

`nbcbot.js`의 `response()` 함수에서 `switch` 문에 새로운 케이스를 추가하세요:

```javascript
case "your-command":
  response = sendRequest("/your-endpoint", params);
  break;
```

### HTTP 요청

- **GET 요청**: `sendRequest(endpoint, params)` 사용
- **POST 요청**: `sendPostRequest(endpoint, data)` 사용
