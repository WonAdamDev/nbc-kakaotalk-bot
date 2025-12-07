const scriptName = "nbcbot";

// HTTP 메서드 Enum (불변 객체)
const HttpMethod = Object.freeze({
  GET: "GET",
  POST: "POST",
  DELETE: "DELETE"
});

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
    let paramMap = {}; // JavaScript 객체로 선언

    switch (command) {
      case "health":
        paramMap = {
          sender: sender,
          room: room,
          timestamp: new Date().getTime(),
        };
        response = sendRequest("/health/", paramMap);
        break;
      
      case "echo":
      case "에코":
        // echo 명령어는 메시지만 포함
        if (params.length === 0) {
          response = `에코할 메시지를 입력하세요. 예: !${command} 안녕하세요`;
          break;
        }
        paramMap = {
          message: params.join(" ")
        };
        response = sendRequest("/api/commands/echo/", paramMap, HttpMethod.POST);
        break;

      case "멤버생성":
      case "멤버추가":
        if(params.length <= 0) {
          response = `파라미터가 부족합니다. (예시 : !${command} 홍길동)`;
          break;
        }
        paramMap = {
          sender: sender,
          room: room,
          member: params[0]
        };

        response = sendRequest("/api/commands/member/", paramMap, HttpMethod.POST);
        response = formatMemberPostResponse(response);
        break;

      case "멤버조회":
      case "멤버확인":
      case "멤버":
        if(params.length <= 0) {
          response = `파라미터가 부족합니다. (예시 : !${command} 홍길동)`;
          break;
        }
        paramMap = {
          room: room,
          member: params[0]
        };

        response = sendRequest("/api/commands/member/", paramMap, HttpMethod.GET);
        response = formatMemberGetResponse(response);
        break;

      case "멤버제거":
      case "멤버삭제":
        if(params.length <= 0) {
          response = `파라미터가 부족합니다. (예시 : !${command} 홍길동)`;
          break;
        }
        paramMap = {
          sender: sender,
          room: room,
          member: params[0]
        };
        response = sendRequest("/api/commands/member/", paramMap, HttpMethod.DELETE);
        response = formatMemberDeleteResponse(response);
        break;

      case "팀배정":
        if(params.length <= 0) {
          response = "파라미터가 부족합니다. (예시 : !팀배정 홍길동 블루)";
          break;
        }

        if(params.length < 2) {
          response = "팀 이름을 입력해주세요. (예시 : !팀배정 홍길동 블루)";
          break;
        }

        paramMap = {
          sender: sender,
          room: room,
          member: params[0],
          team: params[1],
        };

        response = sendRequest("/api/commands/member_team/", paramMap, HttpMethod.POST);
        response = formatMemberTeamPostResponse(response);
        break;

      case "팀배정해제":
        if(params.length <= 0) {
          response = "파라미터가 부족합니다. (예시 : !팀배정해제 홍길동)";
          break;
        }

        paramMap = {
          sender: sender,
          room: room,
          member: params[0],
        };

        response = sendRequest("/api/commands/member_team/", paramMap, HttpMethod.DELETE);
        response = formatMemberTeamDeleteResponse(response);
        break;

      case "팀확인":
        paramMap = {
          sender: sender,
          room: room,
          member: params.length == 0 ? sender : params[0]
        };
        response = sendRequest("/api/commands/member_team/", paramMap, HttpMethod.GET);
        response = formatMemberTeamGetResponse(response);
        break;

      case "팀생성":
      case "팀추가":
        if(params.length <= 0) {
          response = `파라미터가 부족합니다. (예시 : !${command} 블루)`;
          break;
        }
        paramMap = {
          sender: sender,
          room: room,
          team: params[0]
        };
        response = sendRequest("/api/commands/team/", paramMap, HttpMethod.POST);
        response = formatTeamPostResponse(response);
        break;

      case "팀삭제":
      case "팀제거":
        if(params.length <= 0) {
          response = `파라미터가 부족합니다. (예시 : !${command} 블루)`;
          break;
        }
        paramMap = {
          sender: sender,
          room: room,
          team: params[0]
        };
        response = sendRequest("/api/commands/team/", paramMap, HttpMethod.DELETE);
        response = formatTeamDeleteResponse(response);
        break;

      case "팀조회":
      case "팀정보":
        if(params.length <= 0) {
          response = `파라미터가 부족합니다. (예시 : !${command} 블루)`;
          break;
        }
        paramMap = {
          room: room,
          team: params[0]
        };
        response = sendRequest("/api/commands/team/", paramMap, HttpMethod.GET);
        response = formatTeamGetResponse(response);
        break;

      case "경기생성":
      case "게임생성":
        // 날짜 파라미터 optional (기본값: 오늘)
        const gameDate = params.length > 0 ? params[0] : null;
        paramMap = {
          room: room,
          creator: sender
        };
        if (gameDate) {
          paramMap.date = gameDate;
        }
        response = sendRequest("/api/game/create", paramMap, HttpMethod.POST);
        response = formatGameCreateResponse(response);
        break;

      case "경기목록":
      case "경기조회":
      case "게임목록":
        paramMap = {
          room: room
        };
        response = sendRequest("/api/game/list", paramMap, HttpMethod.GET);
        response = formatGameListResponse(response);
        break;

      case "help":
      case "도움말":
      case "도움":
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
 * GET: 쿼리 스트링 사용
 * POST: JSON Body 사용
 * @param {string} endpoint - API 엔드포인트 (예: "/api/commands/test")
 * @param {object} paramMap - 파라미터 객체
 * @param {string} method - HTTP 메서드 (기본값: POST)
 * @returns {string} 서버 응답
 */
function sendRequest(endpoint, paramMap, method) {
  try {
    // 기본값은 POST
    method = method || HttpMethod.POST;

    let urlString = SERVER_BASE_URL + endpoint;

    // HTTP 요청 실행
    const URL = java.net.URL;
    const HttpURLConnection = java.net.HttpURLConnection;
    const BufferedReader = java.io.BufferedReader;
    const InputStreamReader = java.io.InputStreamReader;
    const StringBuilder = java.lang.StringBuilder;

    // GET 요청: 쿼리 스트링으로 파라미터 추가
    if (method === HttpMethod.GET && paramMap && Object.keys(paramMap).length > 0) {
      const queryParams = [];
      for (let key in paramMap) {
        queryParams.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(paramMap[key])));
      }
      urlString = urlString + "?" + queryParams.join("&");
    }

    const url = new URL(urlString);
    const conn = url.openConnection();
    conn.setRequestMethod(method);
    conn.setConnectTimeout(REQUEST_TIMEOUT);
    conn.setReadTimeout(REQUEST_TIMEOUT);

    // POST / DELETE 요청: JSON body 전송
    if (method === HttpMethod.POST || method === HttpMethod.DELETE) {
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

      // paramMap을 JSON 문자열로 변환
      const jsonData = JSON.stringify(paramMap || {});

      // 데이터 전송
      const os = conn.getOutputStream();
      const writer = new java.io.OutputStreamWriter(os, "UTF-8");
      writer.write(jsonData);
      writer.flush();
      writer.close();
      os.close();
    }

    const statusCode = conn.getResponseCode();
    Log.d("[HTTP] Status Code: " + statusCode + ", Method: " + method + ", URL: " + urlString);

    // 응답 읽기
    let inputStream;
    if (statusCode >= 200 && statusCode < 300) {
      inputStream = conn.getInputStream();
    } else {
      inputStream = conn.getErrorStream();
    }

    // inputStream이 null인 경우 처리
    if (!inputStream) {
      conn.disconnect();
      Log.d("[HTTP ERROR] InputStream is null for status: " + statusCode);
      return "서버 응답 오류: 응답 스트림을 읽을 수 없습니다. (Status: " + statusCode + ")";
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

    // 2xx 성공 응답 (200 OK, 201 Created 등) 또는 4xx 에러 응답 처리
    if (statusCode >= 200 && statusCode < 500) {
      // JSON 응답 파싱 시도
      try {
        const jsonResponse = JSON.parse(body);

        // data 필드가 있으면 data 객체를 반환 (새로운 방식)
        if (jsonResponse.data !== undefined) {
          return jsonResponse.data;
        }
        // message 필드가 있으면 반환
        if (jsonResponse.message !== undefined) {
          return jsonResponse.message;
        }
        // success와 response 필드가 있으면 response만 반환 (하위 호환성)
        if (jsonResponse.success !== undefined && jsonResponse.response !== undefined) {
          return jsonResponse.response;
        }
        // 그 외에는 전체 JSON을 문자열로 반환
        return body;
      } catch (e) {
        // JSON 파싱 실패시 원본 반환
        return body;
      }
    } else {
      return "서버 오류: " + statusCode;
    }
  } catch (e) {
    if(paramMap.sender === "원동현") {
      return "요청 실패: 서버가 응답하지 않습니다.\n" + e.message;
    }
    else {
      return "요청 실패: 서버가 응답하지 않습니다.";
    }
  }
}

/**
 * 응답 데이터 포맷팅 함수들
 */

// 멤버 조회 응답 포맷팅
function formatMemberGetResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.exists === false) {
    return data.member + "님은 멤버가 아닙니다.";
  }

  const teamText = data.team || "undefined";
  return data.member + "님 정보\n팀: " + teamText;
}

// 멤버 생성 응답 포맷팅
function formatMemberPostResponse(data) {
  if (typeof data !== 'object') return data;
  return data.member + "님이 멤버가 되었습니다.";
}

// 멤버 삭제 응답 포맷팅
function formatMemberDeleteResponse(data) {
  if (typeof data !== 'object') return data;
  return data.member + "님이 멤버에서 제거되었습니다.";
}

// 팀 조회 응답 포맷팅
function formatTeamGetResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.exists === false) {
    return data.team + "팀은 존재하지 않습니다.";
  }

  if (data.member_count === 0) {
    return data.team + "팀 정보\n멤버 수: 0명";
  }

  const memberList = data.members.join(", ");
  return data.team + "팀 정보\n멤버 수: " + data.member_count + "명\n멤버: " + memberList;
}

// 팀 생성 응답 포맷팅
function formatTeamPostResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.created === true) {
    return data.team + "팀이 생성되었습니다.";
  } else if (data.reason === 'already_exists') {
    return data.team + "팀이 이미 존재합니다.";
  }

  return String(data);
}

// 팀 삭제 응답 포맷팅
function formatTeamDeleteResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.deleted === true) {
    return data.team + "팀이 삭제되었습니다.";
  } else if (data.reason === 'not_found') {
    return data.team + "팀은 존재하지 않습니다.";
  } else if (data.reason === 'has_members') {
    return data.team + "팀에 " + data.member_count + "명의 멤버가 있어 삭제할 수 없습니다.";
  }

  return String(data);
}

// 팀 배정 응답 포맷팅
function formatMemberTeamPostResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.assigned === true) {
    return data.member + "님이 " + data.team + "팀에 배정되었습니다.";
  } else if (data.reason === 'member_not_found') {
    return data.member + "님은 멤버가 아닙니다.";
  } else if (data.reason === 'team_not_found') {
    return data.team + "팀은 존재하지 않습니다.";
  }

  return String(data);
}

// 팀 배정 해제 응답 포맷팅
function formatMemberTeamDeleteResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.unassigned === true) {
    return data.member + "님의 팀 배정(" + data.previous_team + ")이 해제되었습니다.";
  } else if (data.reason === 'member_not_found') {
    return data.member + "님은 멤버가 아닙니다.";
  } else if (data.reason === 'no_team_assigned') {
    return data.member + "님은 팀에 배정되어 있지 않습니다.";
  }

  return String(data);
}

// 팀 확인 응답 포맷팅
function formatMemberTeamGetResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.is_member === false) {
    return data.member + "님은 멤버가 아닙니다.";
  }

  if (data.team) {
    return data.member + "님은 " + data.team + "팀에 배정되어 있습니다.";
  } else {
    return data.member + "님은 팀에 배정되어 있지 않습니다.";
  }
}

// 경기 생성 응답 포맷팅
function formatGameCreateResponse(data) {
  if (typeof data !== 'object') return data;

  if (!data.game_id || !data.url) {
    return "경기 생성에 실패했습니다.";
  }

  return "=== 경기가 생성되었습니다 ===\n\n" +
         "경기 ID: " + data.game_id + "\n" +
         "생성자: " + data.game.creator + "\n" +
         "날짜: " + data.game.date + "\n\n" +
         "경기 관리 페이지:\n" + data.url + "\n\n" +
         "※ 위 링크에서 선수 도착, 쿼터 관리, 점수 기록 등 모든 경기 관리가 가능합니다.";
}

// 경기 목록 응답 포맷팅
function formatGameListResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.count === 0) {
    return "생성된 경기가 없습니다.\n!경기생성 명령어로 새 경기를 만들어주세요.";
  }

  let result = "=== " + data.room + " 경기 목록 ===\n\n";

  for (let i = 0; i < data.games.length; i++) {
    const game = data.games[i];
    const statusEmoji = game.status === '진행중' ? '▶️' : game.status === '종료' ? '✅' : '⏸️';

    // 날짜 포맷팅 (YYYY-MM-DD -> MM/DD)
    const dateStr = game.date ? game.date.substring(5).replace('-', '/') : '';

    // 시간 포맷팅 (ISO -> HH:MM)
    let timeStr = '';
    if (game.created_at) {
      const dt = new java.util.Date(game.created_at);
      const hours = String(dt.getHours()).padStart(2, '0');
      const mins = String(dt.getMinutes()).padStart(2, '0');
      timeStr = hours + ":" + mins;
    }

    result += (i + 1) + ". " + statusEmoji + " " + game.status;
    if (game.status === '진행중') {
      result += " (Q" + game.current_quarter + ")";
    }
    result += "\n";
    result += "   ID: " + game.game_id + "\n";
    result += "   날짜: " + dateStr + " " + timeStr + "\n";
    if (game.creator) {
      result += "   생성: " + game.creator + "\n";
    }
    result += "   URL: " + game.url + "\n";

    if (i < data.games.length - 1) {
      result += "\n";
    }
  }

  result += "\n총 " + data.count + "개 경기";
  result += "\n\n※ 최근 30일 이내 경기만 표시됩니다.";

  return result;
}

/**
 * 도움말 메시지 반환
 */
function getHelpMessage() {
  return "=== NBC 봇 사용 가능한 명령어 ===\n\n" +
         "[서버 관리]\n" +
         "!health - 서버 상태 확인\n\n" +
         "[경기 관리]\n" +
         "!경기생성 [날짜] - 경기 생성 (날짜 생략 시 오늘)\n" +
         "  예: !경기생성\n" +
         "  예: !경기생성 2024-01-25\n" +
         "!경기목록 - 이 방의 경기 목록 조회\n" +
         "  ※ 최근 30일 이내 경기만 표시\n\n" +
         "[멤버 관리]\n" +
         "!멤버생성 [이름] - 멤버 생성\n" +
         "  예: !멤버생성 홍길동\n" +
         "!멤버조회 [이름] - 멤버 정보 조회\n" +
         "  예: !멤버조회 홍길동\n" +
         "!멤버삭제 [이름] - 멤버 제거\n" +
         "  예: !멤버삭제 홍길동\n\n" +
         "[팀 관리]\n" +
         "!팀생성 [팀명] - 팀 생성\n" +
         "  예: !팀생성 블루\n" +
         "!팀조회 [팀명] - 팀 정보 조회\n" +
         "  예: !팀조회 블루\n" +
         "!팀삭제 [팀명] - 팀 삭제\n" +
         "  예: !팀삭제 블루\n" +
         "!팀배정 [이름] [팀] - 멤버를 팀에 배정\n" +
         "  예: !팀배정 홍길동 블루\n" +
         "!팀배정해제 [이름] - 팀 배정 해제\n" +
         "  예: !팀배정해제 홍길동\n" +
         "!팀확인 [이름] - 팀 확인 (생략 시 본인)\n" +
         "  예: !팀확인 / !팀확인 홍길동\n\n" +
         "[기타]\n" +
         "!echo [메시지] - 메시지 에코\n" +
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