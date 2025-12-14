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
const FRONTEND_URL = CONFIG.frontendUrl;
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
          response = "에코할 메시지를 입력하세요. 예: !" + command + " 안녕하세요";
          break;
        }
        paramMap = {
          message: params.join(" ")
        };
        response = sendRequest("/api/commands/echo/", paramMap, HttpMethod.POST);
        break;

      case "멤버조회":
      case "멤버확인":
      case "멤버":
        // 파라미터가 없으면 본인 조회
        paramMap = {
          room: room,
          member: params.length > 0 ? params[0] : sender
        };
        // params[1]이 있으면 member_id로 전달
        if (params.length >= 2) {
          paramMap.member_id = params[1];
        }

        response = sendRequest("/api/commands/member/", paramMap, HttpMethod.GET);
        response = formatMemberGetResponse(response);
        break;

      case "팀확인":
        paramMap = {
          sender: sender,
          room: room,
          member: params.length == 0 ? sender : params[0]
        };
        // params[1]이 있으면 member_id로 전달
        if (params.length >= 2) {
          paramMap.member_id = params[1];
        }
        response = sendRequest("/api/commands/member_team/", paramMap, HttpMethod.GET);
        response = formatMemberTeamGetResponse(response);
        break;

      case "팀조회":
      case "팀정보":
        if(params.length <= 0) {
          response = "파라미터가 부족합니다. (예시 : !" + command + " 블루)";
          break;
        }
        paramMap = {
          room: room,
          team: params[0]
        };
        response = sendRequest("/api/commands/team/", paramMap, HttpMethod.GET);
        response = formatTeamGetResponse(response);
        break;

      case "팀목록":
        paramMap = {
          room: room
        };
        response = sendRequest("/api/commands/team/list", paramMap, HttpMethod.GET);
        Log.d("[팀목록] 서버 응답: " + JSON.stringify(response));
        Log.d("[팀목록] 응답 타입: " + (typeof response));
        response = formatTeamListResponse(response);
        break;

      case "멤버목록":
        paramMap = {
          room: room
        };
        response = sendRequest("/api/commands/member/list", paramMap, HttpMethod.GET);
        Log.d("[멤버목록] 서버 응답: " + JSON.stringify(response));
        Log.d("[멤버목록] 응답 타입: " + (typeof response));
        response = formatMemberListResponse(response);
        break;

      case "경기목록":
      case "경기조회":
      case "게임목록":
        paramMap = {
          room: room,
          days: 7,
          limit: 100
        };
        response = sendRequest("/api/game/all", paramMap, HttpMethod.GET);
        response = formatGameListResponse(response);
        break;

      case "프론트엔드":
      case "링크":
      case "웹":
        if (FRONTEND_URL) {
          response = "NBC 봇 프론트엔드\n" + FRONTEND_URL + "\n\n※ 경기 생성 및 관리는 Admin 페이지에서 가능합니다.";
        } else {
          response = "프론트엔드 URL이 설정되지 않았습니다.";
        }
        break;

      case "help":
      case "도움말":
      case "도움":
        if (params.length > 0 && params[0] === "상세") {
          response = getDetailedHelpMessage();
        } else {
          response = getBriefHelpMessage();
        }
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

  // 동명이인 체크
  if (data.is_unique === false && data.duplicates) {
    var result = data.member + "님은 동명이인이 " + data.count + "명 있습니다.\n";
    result += "member_id를 함께 입력해주세요.\n\n";
    for (var i = 0; i < data.duplicates.length; i++) {
      var dup = data.duplicates[i];
      result += "ID: " + dup.member_id + " (팀: " + (dup.team || "없음") + ")\n";
    }
    return result;
  }

  const teamText = data.team || "없음";
  let result = data.member + "님 정보\n팀: " + teamText;

  // member_id 전체 표시
  if (data.member_id) {
    result += "\nID: " + data.member_id;
  }

  return result;
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

  // 동명이인 확인을 위해 이름별로 카운트
  const nameCount = {};
  for (let i = 0; i < data.members.length; i++) {
    const memberName = typeof data.members[i] === 'object' ? data.members[i].name : data.members[i];
    nameCount[memberName] = (nameCount[memberName] || 0) + 1;
  }

  // 멤버 리스트 포맷팅
  const memberList = data.members.map(function(m) {
    // 하위 호환성: 문자열인 경우 그대로 반환
    if (typeof m === 'string') return m;

    // 동명이인이 있고 member_id가 있으면 ID 마지막 4자리 표시
    const hasDuplicate = nameCount[m.name] > 1;
    if (hasDuplicate && m.member_id) {
      return m.name + " #" + m.member_id.substring(m.member_id.length - 4);
    }
    return m.name;
  }).join(", ");

  return data.team + "팀 정보\n멤버 수: " + data.member_count + "명\n멤버: " + memberList;
}



// 팀 확인 응답 포맷팅
function formatMemberTeamGetResponse(data) {
  if (typeof data !== 'object') return data;

  if (data.is_member === false) {
    return data.member + "님은 멤버가 아닙니다.";
  }

  // 동명이인 체크
  if (data.is_unique === false && data.duplicates) {
    var result = data.member + "님은 동명이인이 " + data.count + "명 있습니다.\n";
    result += "member_id를 함께 입력해주세요.\n\n";
    for (var i = 0; i < data.duplicates.length; i++) {
      var dup = data.duplicates[i];
      result += "ID: " + dup.member_id + " (팀: " + (dup.team || "없음") + ")\n";
    }
    return result;
  }

  // 단일 멤버
  if (data.team) {
    var result = data.member + "님은 " + data.team + "팀에 배정되어 있습니다.";
    if (data.member_id) {
      result += "\nID: " + data.member_id;
    }
    return result;
  } else {
    var result = data.member + "님은 팀에 배정되어 있지 않습니다.";
    if (data.member_id) {
      result += "\nID: " + data.member_id;
    }
    return result;
  }
}


// 숫자를 2자리로 패딩하는 헬퍼 함수 (padStart 대체)
function padZero(num) {
  return num < 10 ? '0' + num : String(num);
}

// ISO 날짜 문자열을 파싱하는 헬퍼 함수 (UTC -> KST 변환)
// ISO 날짜 문자열을 파싱하는 헬퍼 함수 (UTC -> KST 변환)
function parseISODateTime(isoString) {
  try {
    // ISO 8601: 2024-12-07T15:30:00Z (UTC 시간)
    var date = new Date(isoString);

    // KST는 UTC+9
    var kstOffset = 9 * 60; // 9시간을 분으로 변환
    var utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    var kstMinutes = utcMinutes + kstOffset;

    var hours = Math.floor(kstMinutes / 60) % 24;
    var minutes = kstMinutes % 60;

    return {
      hours: hours,
      minutes: minutes
    };
    // ISO 8601: 2024-12-07T15:30:00Z (UTC 시간)
    var date = new Date(isoString);

    // KST는 UTC+9
    var kstOffset = 9 * 60; // 9시간을 분으로 변환
    var utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
    var kstMinutes = utcMinutes + kstOffset;

    var hours = Math.floor(kstMinutes / 60) % 24;
    var minutes = kstMinutes % 60;

    return {
      hours: hours,
      minutes: minutes
    };
  } catch (e) {
    return null;
  }
}

// 경기 목록 응답 포맷팅
function formatGameListResponse(data) {
  if (typeof data !== 'object') return data;

  // /api/game/all 응답 구조에 맞게 수정
  var games = data.games || [];
  var totalItems = data.pagination ? data.pagination.total_items : games.length;
  var roomName = games.length > 0 && games[0].room ? games[0].room : "전체";
  var roomUrl = games.length > 0 && games[0].room_url ? games[0].room_url : null;
  var roomUrl = games.length > 0 && games[0].room_url ? games[0].room_url : null;

  if (totalItems === 0) {
    return "생성된 경기가 없습니다.\nAdmin 페이지에서 새 경기를 만들어주세요.";
  }

  var result = "=== " + roomName + " 경기 목록 ===\n";
  if (roomUrl) {
    result += "방 URL: " + roomUrl + "\n";
  }
  result += "\n";
  var result = "=== " + roomName + " 경기 목록 ===\n";
  if (roomUrl) {
    result += "방 URL: " + roomUrl + "\n";
  }
  result += "\n";

  for (var i = 0; i < games.length; i++) {
    var game = games[i];
    var statusEmoji = game.status === '진행중' ? '▶️' : game.status === '종료' ? '✅' : '⏸️';

    // 날짜 포맷팅 (YYYY-MM-DD -> MM/DD)
    var dateStr = game.date ? game.date.substring(5).replace('-', '/') : '';

    // 시간 포맷팅 (ISO -> HH:MM)
    var timeStr = '';
    if (game.created_at) {
      var timeData = parseISODateTime(game.created_at);
      if (timeData) {
        timeStr = padZero(timeData.hours) + ":" + padZero(timeData.minutes);
      }
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
    result += "   경기 URL: " + game.url + "\n";
    result += "   경기 URL: " + game.url + "\n";

    if (i < games.length - 1) {
      result += "\n";
    }
  }

  result += "\n총 " + totalItems + "개 경기";
  result += "\n\n※ 최근 7일 이내 경기만 표시됩니다.";

  return result;
}

// 멤버 목록 응답 포맷팅
function formatMemberListResponse(data) {
  Log.d("[formatMemberListResponse] 입력 데이터: " + JSON.stringify(data));

  if (typeof data !== 'object') return data;

  var members = data.members || [];
  var count = data.count || 0;
  var roomName = data.room || "이 방";

  Log.d("[formatMemberListResponse] members 길이: " + members.length + ", count: " + count);

  if (count === 0) {
    return "등록된 멤버가 없습니다.";
  }

  var result = "=== " + roomName + " 멤버 목록 ===\n\n";

  for (var i = 0; i < members.length; i++) {
    var member = members[i];
    result += (i + 1) + ". " + member.name;
    if (member.team) {
      result += " (" + member.team + "팀)";
    } else {
      result += " (팀 미배정)";
    }
    result += "\n";
    result += "   ID: " + member.member_id + "\n";
    if (i < members.length - 1) {
      result += "\n";
    }
  }

  result += "\n총 " + count + "명";

  return result;
}

// 팀 목록 응답 포맷팅
function formatTeamListResponse(data) {
  Log.d("[formatTeamListResponse] 입력 데이터: " + JSON.stringify(data));

  if (typeof data !== 'object') return data;

  var teams = data.teams || [];
  var count = data.count || 0;
  var roomName = data.room || "이 방";

  Log.d("[formatTeamListResponse] teams 길이: " + teams.length + ", count: " + count);

  if (count === 0) {
    return "생성된 팀이 없습니다.";
  }

  var result = "=== " + roomName + " 팀 목록 ===\n\n";

  for (var i = 0; i < teams.length; i++) {
    var team = teams[i];
    result += (i + 1) + ". " + team.name + "팀";
    result += " (멤버 " + team.member_count + "명)\n";
    result += "   ID: " + team.team_id + "\n";
    if (i < teams.length - 1) {
      result += "\n";
    }
  }

  result += "\n총 " + count + "개 팀";

  return result;
}

/**
 * 간략한 도움말 메시지 반환
 */
function getBriefHelpMessage() {
  return "━━━━━ 🏀 NBC 봇 명령어 ━━━━━\n\n" +
         "🏆 !경기목록\n" +
         "  → 최근 7일 경기 목록 조회\n\n" +
         "👥 !멤버조회 [이름]\n" +
         "  → 멤버 정보 조회 (생략 시 본인)\n" +
         "  예) !멤버조회 / !멤버조회 홍길동\n\n" +
         "👕 !팀조회 [팀명]\n" +
         "  → 팀 정보 조회\n" +
         "  예) !팀조회 블루\n\n" +
         "━━━━━━━━━━━━━━━━━━━\n\n" +
         "💡 더 많은 명령어를 보려면\n" +
         "   !도움말 상세 를 입력하세요";
}

/**
 * 자세한 도움말 메시지 반환
 */
function getDetailedHelpMessage() {
  return "━━━━━ 🏀 NBC 봇 명령어 ━━━━━\n\n" +
         "🏆 경기 관리\n" +
         "!경기목록\n" +
         "  → 최근 7일 경기 목록 조회\n\n" +
         "!링크\n" +
         "  → 웹 페이지 링크 확인\n" +
         "  → 경기 생성은 Admin 페이지에서\n\n" +
         "━━━━━━━━━━━━━━━━━━━\n\n" +
         "👥 멤버 관리\n" +
         "!멤버목록\n" +
         "  → 전체 멤버 조회\n\n" +
         "!멤버조회 [이름] [ID]\n" +
         "  → 멤버 정보 조회 (생략 시 본인)\n" +
         "  예) !멤버조회\n" +
         "  예) !멤버조회 홍길동\n" +
         "  예) !멤버조회 홍길동 MEM_12345678\n\n" +
         "━━━━━━━━━━━━━━━━━━━\n\n" +
         "👕 팀 관리\n" +
         "!팀목록\n" +
         "  → 전체 팀 조회\n\n" +
         "!팀조회 [팀명]\n" +
         "  → 팀 정보 조회\n" +
         "  예) !팀조회 블루\n\n" +
         "!팀확인 [이름] [ID]\n" +
         "  → 팀 배정 확인 (생략 시 본인)\n" +
         "  예) !팀확인\n" +
         "  예) !팀확인 홍길동\n" +
         "  예) !팀확인 홍길동 MEM_12345678\n\n" +
         "💡 동명이인은 ID로 구분합니다";
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