const scriptName = "nbcbot";

// config.json 파일 읽기 (여러 경로 시도)
function loadConfig() {
  // 여러 경로 시도
  const paths = [
    "/storage/emulated/0/msgbot/Bots/nbcbot/config.json",
    "/sdcard/msgbot/Bots/nbcbot/config.json",
    "Bots/config.json",
    "config.json"
  ];

  let configData = null;
  let errors = [];

  for (let i = 0; i < paths.length; i++) {
    try {
      Log.d("시도 중: " + paths[i]);

      // 절대 경로로 변환하여 로그
      try {
        const file = new java.io.File(paths[i]);
        Log.d("  -> 절대 경로: " + file.getAbsolutePath());
        Log.d("  -> 파일 존재: " + file.exists());
      } catch (e) {
        Log.d("  -> 경로 확인 실패: " + e.message);
      }

      configData = FileStream.read(paths[i]);
      if (configData) {
        Log.d("  -> 성공!");
        break;
      }
    } catch (e) {
      Log.d("  -> 실패: " + e.message);
      errors.push(paths[i] + ": " + e.message);
      continue;
    }
  }

  if (!configData) {
    throw new Error("config.json을 찾을 수 없습니다.\n시도한 경로:\n" + errors.join("\n"));
  }

  return JSON.parse(configData);
}

// 스크립트 로드 시점에 config 로드
const CONFIG = loadConfig();
const SERVER_BASE_URL = CONFIG.serverUrl;
const REQUEST_TIMEOUT = CONFIG.timeout;

/**
 * (string) room
 * (string) sender
 * (boolean) isGroupChat
 * (void) replier.reply(message)
 * (boolean) replier.reply(room, message, hideErrorToast = false) // 전송 성공시 true, 실패시 false 반환
 * (string) imageDB.getProfileBase64()
 * (string) packageName
 */
function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  // 명령어 체크 (!로 시작하는지)
  if (!msg.startsWith("!")) {
    return; // 명령어가 아니면 무시
  }

  // 명령어와 파라미터 파싱
  const parts = msg.trim().split(/\s+/);
  const command = parts[0].substring(1).toLowerCase(); // "!" 제거하고 소문자로 변환
  const params = parts.slice(1); // 나머지는 파라미터

  // 명령어에 따라 처리
  try {
    let response = "";

    switch (command) {
      case "health":
        response = sendRequest("/health", params);
        break;

      case "help":
      case "도움말":
        response = getHelpMessage();
        break;

      default:
        response = "알 수 없는 명령어입니다. !도움말을 입력하세요.";
    }

    if (response) {
      replier.reply(response);
    }
  } catch (e) {
    replier.reply("오류가 발생했습니다: " + e.message);
  }
}

/**
 * 백엔드 서버에 HTTP 요청 전송
 * @param {string} endpoint - API 엔드포인트 (예: "/command_a")
 * @param {Array} params - 파라미터 배열
 * @returns {string} 서버 응답
 */
function sendRequest(endpoint, params) {
  try {
    let urlString = SERVER_BASE_URL + endpoint;

    // GET 요청 (파라미터를 쿼리스트링으로)
    if (params && params.length > 0) {
      const queryString = params.map((p, i) => "param" + (i + 1) + "=" + encodeURIComponent(p)).join("&");
      urlString = urlString + "?" + queryString;
    }

    // HTTP 요청 실행
    const URL = java.net.URL;
    const HttpURLConnection = java.net.HttpURLConnection;
    const BufferedReader = java.io.BufferedReader;
    const InputStreamReader = java.io.InputStreamReader;
    const StringBuilder = java.lang.StringBuilder;

    const url = new URL(urlString);
    const conn = url.openConnection();
    conn.setRequestMethod("GET");
    conn.setConnectTimeout(REQUEST_TIMEOUT);
    conn.setReadTimeout(REQUEST_TIMEOUT);

    const statusCode = conn.getResponseCode();

    // 응답 읽기
    let inputStream;
    if (statusCode >= 200 && statusCode < 300) {
      inputStream = conn.getInputStream();
    } else {
      inputStream = conn.getErrorStream();
    }

    const reader = new BufferedReader(new InputStreamReader(inputStream, "UTF-8"));
    const responseBuilder = new StringBuilder();
    let line;

    while ((line = reader.readLine()) !== null) {
      responseBuilder.append(line);
    }
    reader.close();
    conn.disconnect();

    const body = responseBuilder.toString();

    if (statusCode === 200) {
      return body;
    } else {
      return "서버 오류: " + statusCode;
    }
  } catch (e) {
    return "요청 실패: " + e.message;
  }
}

/**
 * POST 요청이 필요한 경우 사용
 * @param {string} endpoint - API 엔드포인트
 * @param {object} data - 전송할 데이터 객체
 * @returns {string} 서버 응답
 */
function sendPostRequest(endpoint, data) {
  try {
    const urlString = SERVER_BASE_URL + endpoint;

    // HTTP 요청 실행
    const URL = java.net.URL;
    const HttpURLConnection = java.net.HttpURLConnection;
    const BufferedReader = java.io.BufferedReader;
    const InputStreamReader = java.io.InputStreamReader;
    const OutputStream = java.io.OutputStream;
    const StringBuilder = java.lang.StringBuilder;

    const url = new URL(urlString);
    const conn = url.openConnection();
    conn.setRequestMethod("POST");
    conn.setConnectTimeout(REQUEST_TIMEOUT);
    conn.setReadTimeout(REQUEST_TIMEOUT);
    conn.setDoOutput(true);
    conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");

    // POST 데이터 생성
    const postParams = [];
    for (let key in data) {
      postParams.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(data[key])));
    }
    const postData = postParams.join("&");

    // 데이터 전송
    const os = conn.getOutputStream();
    const writer = new java.io.OutputStreamWriter(os, "UTF-8");
    writer.write(postData);
    writer.flush();
    writer.close();
    os.close();

    const statusCode = conn.getResponseCode();

    // 응답 읽기
    let inputStream;
    if (statusCode >= 200 && statusCode < 300) {
      inputStream = conn.getInputStream();
    } else {
      inputStream = conn.getErrorStream();
    }

    const reader = new BufferedReader(new InputStreamReader(inputStream, "UTF-8"));
    const responseBuilder = new StringBuilder();
    let line;

    while ((line = reader.readLine()) !== null) {
      responseBuilder.append(line);
    }
    reader.close();
    conn.disconnect();

    const body = responseBuilder.toString();

    if (statusCode === 200) {
      return body;
    } else {
      return "서버 오류: " + statusCode;
    }
  } catch (e) {
    return "요청 실패: " + e.message;
  }
}

/**
 * 도움말 메시지 반환
 */
function getHelpMessage() {
  return "사용 가능한 명령어:\n" +
         "!health - 서버에 Ping 보내기\n" +
         "!도움말 - 이 메시지 표시";
}

//아래 4개의 메소드는 액티비티 화면을 수정할때 사용됩니다.
function onCreate(savedInstanceState, activity) {
  var textView = new android.widget.TextView(activity);
  textView.setText("Hello, World!");
  textView.setTextColor(android.graphics.Color.DKGRAY);
  activity.setContentView(textView);
}

function onStart(activity) {}

function onResume(activity) {}

function onPause(activity) {}

function onStop(activity) {}