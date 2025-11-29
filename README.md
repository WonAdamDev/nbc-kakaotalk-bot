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
- [백엔드 서버](https://github.com/WonAdamDev/nbc-kakaotalk-bot-server)

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
