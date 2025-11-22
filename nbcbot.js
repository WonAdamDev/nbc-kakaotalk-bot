const scriptName = "nbcbot";

// config.json 파일 읽기 (여러 경로 시도)
function loadConfig() {
  // 현재 작업 디렉토리 로그
  try {
    const currentDir = new java.io.File(".").getAbsolutePath();
    Log.d("현재 작업 디렉토리: " + currentDir);

    // 현재 디렉토리의 파일 목록 출력
    try {
      const currentDirFile = new java.io.File(".");
      const currentFiles = currentDirFile.listFiles();
      if (currentFiles && currentFiles.length > 0) {
        Log.d("현재 디렉토리 파일 목록 (" + currentFiles.length + "개):");
        for (let i = 0; i < currentFiles.length; i++) {
          const f = currentFiles[i];
          const type = f.isDirectory() ? "[DIR]" : "[FILE]";
          Log.d("  " + type + " " + f.getName());
        }
      } else {
        Log.d("현재 디렉토리에 파일이 없거나 읽을 수 없습니다.");
      }
    } catch (e) {
      Log.d("파일 목록 출력 실패: " + e.message);
    }

    // 몇 가지 가능성 있는 경로도 확인
    const possibleDirs = [
      "/storage/emulated/0/msgbot",
      "/storage/emulated/0/msgbot/nbcbot",
      "/sdcard/msgbot",
      "/sdcard/msgbot/nbcbot"
    ];

    for (let i = 0; i < possibleDirs.length; i++) {
      try {
        const checkDir = new java.io.File(possibleDirs[i]);
        if (checkDir.exists()) {
          Log.d("디렉토리 존재: " + possibleDirs[i]);
          const dirFiles = checkDir.listFiles();
          if (dirFiles && dirFiles.length > 0) {
            Log.d("  파일 목록 (" + dirFiles.length + "개):");
            for (let j = 0; j < Math.min(dirFiles.length, 10); j++) {
              const f = dirFiles[j];
              const type = f.isDirectory() ? "[DIR]" : "[FILE]";
              Log.d("    " + type + " " + f.getName());
            }
            if (dirFiles.length > 10) {
              Log.d("    ... 외 " + (dirFiles.length - 10) + "개");
            }
          }
        }
      } catch (e) {
        Log.d("디렉토리 확인 실패 (" + possibleDirs[i] + "): " + e.message);
      }
    }
  } catch (e) {
    Log.d("작업 디렉토리 확인 실패: " + e.message);
  }

  // 여러 경로 시도
  const paths = [
    "/storage/emulated/0/msgbot/nbcbot/config.json",
    "/sdcard/msgbot/nbcbot/config.json",
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
    const url = SERVER_BASE_URL + endpoint;

    // GET 요청 (파라미터를 쿼리스트링으로)
    let fullUrl = url;
    if (params && params.length > 0) {
      const queryString = params.map((p, i) => "param" + (i + 1) + "=" + encodeURIComponent(p)).join("&");
      fullUrl = url + "?" + queryString;
    }

    // HTTP 요청 실행
    const conn = Jsoup.connect(fullUrl)
      .ignoreContentType(true)
      .ignoreHttpErrors(true)
      .timeout(REQUEST_TIMEOUT);

    const response = conn.execute();
    const statusCode = response.statusCode();
    const body = response.body();

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
    const url = SERVER_BASE_URL + endpoint;

    const conn = Jsoup.connect(url)
      .ignoreContentType(true)
      .ignoreHttpErrors(true)
      .timeout(REQUEST_TIMEOUT)
      .method(org.jsoup.Connection.Method.POST);

    // 데이터 추가
    for (let key in data) {
      conn.data(key, String(data[key]));
    }

    const response = conn.execute();
    const statusCode = response.statusCode();
    const body = response.body();

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