/***********************
定数＆グローバル変数
***********************/
const MAX_TASKS = 2; // タスク回数：5つのタスク×5つのイージング関数
const TIME_LIMIT_MS = 15000; // タスク制限時間(ms)
const EASING_FUNCS = ["linear", "easeInOutQuad", "easeInOutQuint", "easeInOutExpo", "easeInOutBack"];

// 固定タスクセットを追加
const FIXED_TASKS = [
  { category: "スポーツ・アウトドア", subcat: "ゴルフ", item: "ゴルフボール" },
  { category: "日常食料品", subcat: "フルーツ", item: "りんご" },
  { category: "ペット日用品", subcat: "ペットフード", item: "ドッグフード" },
  { category: "園芸・ガーデン", subcat: "園芸用品", item: "植木鉢" },
  { category: "書籍・雑誌・漫画・児童書", subcat: "書籍", item: "小説" },
];

const LATIN_SQUARE = [
  [0, 1, 2, 3, 4],
  [1, 2, 3, 4, 0],
  [2, 3, 4, 0, 1],
  [3, 4, 0, 1, 2],
  [4, 0, 1, 2, 3],
];

// グローバル管理（surveyLogsは廃止して、全てをallLogs[]に統合）
let currentTaskIndex = 0;
let startTime = 0;
let errorCount = 0;
let timeoutId = null;
let allLogs = []; // 各タスクのログ + アンケート回答をまとめて保持
let firstClickTime = null;
let clicksThisTask = [];
let menuTravelDistance = 0;
let lastClickTime = 0;
let lastClickDepth = 0;
let currentlyOpenMenus = [];
let categoriesData = [];
let currentTaskEasing = "";
let currentCorrectPath = [];
let isAnimating = false;
let isTutorialActive = false;
let tutorialTargetItem = "トイレットペーパー"; // チュートリアルでクリックする商品名
let tutorialOverlay = null;
let startTutorialBtn = null;
let startTaskBtn = null;

/***********************
ユーティリティ関数
***********************/

function resetAllInfo() {
  currentTaskIndex = 0;
  startTime = 0;
  errorCount = 0;
  clearTimeout(timeoutId);
  timeoutId = null;
  allLogs = [];
  firstClickTime = null;
  clicksThisTask = [];
  menuTravelDistance = 0;
  lastClickTime = 0;
  lastClickDepth = 0;
  isTutorialActive = false;
}

function resetTaskVars() {
  clicksThisTask = [];
  errorCount = 0;
  menuTravelDistance = 0;
  lastClickTime = 0;
  lastClickDepth = 0;
  firstClickTime = null;
}

function generateRandomParticipantId() {
  return Math.floor(Math.random() * 1000);
}

function setNewParticipantId() {
  const newId = generateRandomParticipantId();
  // URLクエリで participant を更新（任意）
  const newUrl = `${window.location.pathname}?participant=${newId}`;
  window.history.replaceState({}, "", newUrl);
  return newId;
}

const participantId = setNewParticipantId();
console.log("参加者ID:", participantId);

/***********************
Netlifyフォーム送信関数
***********************/
function submitToNetlify() {
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get("participant") || participantId || "不明";

  // hiddenフィールドに値セット
  document.getElementById("participantIdField").value = pid;
  document.getElementById("netlifyFormData").value = JSON.stringify({
    participantId: pid,
    taskResults: allLogs,
    timestamp: new Date().toISOString()
  });

  // action属性もセット
  const form = document.getElementById("netlifyForm");
  form.action = `thank-you.html?participant=${encodeURIComponent(pid)}`;

  // フォーム送信！
  form.submit();
}

/***********************
HTMLテンプレート取得（チュートリアルオーバーレイ）
***********************/

function createTutorialOverlay() {
  const template = document.getElementById("tutorial-overlay-template");
  if (!template) {
    console.error("Tutorial overlay template not found");
    return null;
  }

  const overlay = document.createElement("div");
  overlay.classList.add("overlay", "hidden");
  overlay.appendChild(template.content.cloneNode(true));
  const closeTutorialBtn = overlay.querySelector("#closeTutorialBtn");
  if (closeTutorialBtn) {
    closeTutorialBtn.addEventListener("click", () => {
      overlay.classList.add("hidden");
      const feedbackElem = document.getElementById("feedback");
      if (feedbackElem) {
        feedbackElem.textContent = "";
        feedbackElem.className = "";
      }
      const taskInfo = document.getElementById("taskInfo");
      if (taskInfo) {
        taskInfo.textContent = "";
      }
      const startTutorialBtn = document.getElementById("startTutorialBtn");
      const startTaskBtn = document.getElementById("taskStartBtn");
      if (startTutorialBtn) {
        startTutorialBtn.disabled = false;
      }
      if (startTaskBtn) {
        startTaskBtn.disabled = false;
      }
      closeAllSubmenus();
      resetAllInfo();
    });
  } else {
    console.error("閉じるボタンが見つかりませんでした");
  }
  return overlay;
}

/***********************
メニュー生成（再帰）
***********************/

function createMenuRecursive(categoryArray, parentUL) {
  categoryArray.forEach((cat) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = cat.name;
    btn.classList.add("menu-item");
    if (cat.subcategories && cat.subcategories.length > 0) {
      const subUl = document.createElement("ul");
      subUl.classList.add("submenu");
      createMenuRecursive(cat.subcategories, subUl);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        recordClick(cat.name);
        if (!isTutorialActive) {
          // ミスクリック（誤親カテゴリを開いた等）
          const currentDepth = getCategoryDepthByName(categoriesData, cat.name);
          if (currentDepth >= 1 && cat.name !== currentCorrectPath[currentDepth]) {
            errorCount++;
          }
        }
        animateSubmenu(subUl);
      });
      li.appendChild(btn);
      li.appendChild(subUl);
    } else {
      // リーフノード（商品）
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        recordClick(cat.name);
        if (isTutorialActive) {
          checkTutorialAnswer(cat.name);
        } else {
          checkAnswer(cat.name);
          closeAllSubmenus();
        }
      });
      li.appendChild(btn);
    }
    parentUL.appendChild(li);
  });
}

/***********************
クリック記録関数
***********************/

function recordClick(categoryName) {
  const currentClickTime = performance.now();
  const currentDepth = getCategoryDepthByName(categoriesData, categoryName);
  if (firstClickTime === null) {
    firstClickTime = (currentClickTime - startTime) / 1000;
  }

  let stayTime = 0;
  if (lastClickTime !== 0) {
    stayTime = (currentClickTime - lastClickTime) / 1000;
  }

  clicksThisTask.push({
    name: categoryName,
    depth: currentDepth,
    duringAnimation: isAnimating,
    stayTime: parseFloat(stayTime.toFixed(2)),
  });
  menuTravelDistance += Math.abs(currentDepth - lastClickDepth);
  lastClickTime = currentClickTime;
  lastClickDepth = currentDepth;
}

/***********************
チュートリアル開始／回答チェック
***********************/

function startTutorial() {
  isTutorialActive = true;
  resetTaskVars();
  const taskInfo = document.getElementById("taskInfo");
  taskInfo.textContent = `【チュートリアル】「${tutorialTargetItem}」をメニューから見つけて、クリックしてください。`;
  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    feedbackElem.textContent = "（チュートリアル：時間切れです もう一度トライ可能）";
    feedbackElem.classList.add("timeout");
  }, TIME_LIMIT_MS);
  startTime = performance.now();
  document.getElementById("menu-placeholder").style.display = "block";
}

function checkTutorialAnswer(clickedText) {
  const feedbackElem = document.getElementById("feedback");
  if (clickedText !== tutorialTargetItem) {
    feedbackElem.textContent = "チュートリアル：違う項目です。";
    feedbackElem.classList.remove("correct", "timeout");
    feedbackElem.classList.add("incorrect");
    setTimeout(() => {
      feedbackElem.textContent = "";
      feedbackElem.className = "";
    }, 2000);
    return;
  }

  clearTimeout(timeoutId);
  feedbackElem.textContent = "チュートリアル：正解です！";
  feedbackElem.classList.remove("incorrect", "timeout");
  feedbackElem.classList.add("correct");
  closeAllSubmenus();
  // チュートリアル完了 ⇒ オーバーレイ表示
  tutorialOverlay.classList.remove("hidden");
}

/***********************
本番タスク開始／正解チェック／タイムアウト
***********************/

function startTask() {
  isTutorialActive = false;
  allLogs = [];
  currentTaskIndex = 0;
  document.getElementById("resultsPage").style.display = "none";
  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";
  startNextTask();
}

function startNextTask() {
  // 終了判定を最初に行う
  if (currentTaskIndex >= MAX_TASKS) {
    showRewardScreen();
    return;
  }

  currentTaskIndex++; // ここでインクリメント
  resetTaskVars();
  closeAllSubmenus();
  clearTimeout(timeoutId);

  // ラテン方格のインデックス計算（currentTaskIndexは1始まり）
  const rowIndex = participantId % 5;
  const colIndex = (currentTaskIndex - 1) % 5; // 0-4の範囲

  // タスクインデックス計算（行を1つずらす）
  const easingIndex = LATIN_SQUARE[rowIndex][colIndex];
  const taskIndex = LATIN_SQUARE[(rowIndex + 1) % 5][colIndex];

  // 現在のイージングとタスクを設定
  currentTaskEasing = EASING_FUNCS[easingIndex];
  const currentTask = FIXED_TASKS[taskIndex];

  // HTMLのセレクトも更新 (デモ的に動的切り替え)
  const assignedDropdownValue = `var(--${currentTaskEasing})`;
  const easingSelect = document.getElementById("easingSelect");
  for (const option of easingSelect.options) {
    if (option.value === assignedDropdownValue) {
      option.selected = true;
      break;
    }
  }
  updateEasingFunction();

  // 固定タスクから対象商品を設定
  const targetItemName = currentTask.item;
  const taskInfo = document.getElementById("taskInfo");
  taskInfo.textContent = `タスク ${currentTaskIndex}/${MAX_TASKS}： 「${targetItemName}」をメニューから見つけて、クリックしてください。`;

  // 正解パスを取得
  currentCorrectPath = findPathToLeaf(categoriesData, targetItemName) || [];

  // ログ出力（デバッグ用）
  console.log(`タスク${currentTaskIndex}: イージング=${currentTaskEasing}, 商品=${targetItemName}, タスクインデックス=${taskIndex}`);

  startTime = performance.now();
  // タイムアウト設定
  timeoutId = setTimeout(() => {
    handleTimeout(targetItemName);
  }, TIME_LIMIT_MS);
}

function checkAnswer(clickedText) {
  const endTime = performance.now();
  const totalTimeSec = ((endTime - startTime) / 1000).toFixed(2);
  const feedbackElem = document.getElementById("feedback");
  const taskInfo = document.getElementById("taskInfo");
  const match = taskInfo.textContent.match(/「(.*?)」/);
  if (!match) return;
  const targetItemName = match[1];

  if (clickedText !== targetItemName) {
    errorCount++;
    feedbackElem.textContent = "間違いです。もう一度試してください。";
    feedbackElem.classList.remove("correct", "timeout");
    feedbackElem.classList.add("incorrect");
    setTimeout(() => {
      feedbackElem.textContent = "";
      feedbackElem.className = "";
    }, 2000);
    return;
  }

  // 正解時
  feedbackElem.textContent = "正解です！";
  feedbackElem.className = "correct";
  const firstClickTimeSec = firstClickTime !== null ? parseFloat(firstClickTime.toFixed(2)) : "N/A";

  // タスクログを保存（アンケート回答以外をここでまとめる）
  allLogs.push({
    taskIndex: currentTaskIndex,
    correctItem: targetItemName,
    totalTime: totalTimeSec,
    errorCount: errorCount,
    timedOut: false,
    usedEasing: currentTaskEasing,
    firstClickTime: firstClickTimeSec,
    menuTravelDistance: menuTravelDistance,
    clicks: clicksThisTask,
  });

  // タスク終了オーバーレイを表示
  showTaskEndOverlay();
}

function handleTimeout(targetItemName) {
  clearTimeout(timeoutId);
  const feedbackElem = document.getElementById("feedback");
  feedbackElem.classList.add("timeout");
  const firstClickTimeSec = firstClickTime !== null ? parseFloat(firstClickTime.toFixed(2)) : "N/A";

  allLogs.push({
    taskIndex: currentTaskIndex,
    correctItem: targetItemName,
    totalTime: (TIME_LIMIT_MS / 1000).toFixed(2),
    errorCount: errorCount,
    timedOut: true,
    usedEasing: currentTaskEasing,
    firstClickTime: firstClickTimeSec,
    menuTravelDistance: menuTravelDistance,
    clicks: clicksThisTask,
  });

  // タスク終了オーバーレイを表示
  showTaskEndOverlay();
}

function showTaskEndOverlay() {
  const taskEndOverlay = document.getElementById("taskEndOverlay");
  const continueTaskBtn = taskEndOverlay.querySelector("#continueTaskBtn");
  if (currentTaskIndex === MAX_TASKS) {
    continueTaskBtn.textContent = "結果へ進む";
  } else {
    continueTaskBtn.textContent = "次のタスクへ";
  }
  taskEndOverlay.classList.remove("hidden");
}

/***********************
結果表示／Netlifyフォームで送信
***********************/

function showResultsPage() {
  // フィードバック欄リセット
  const feedbackElem = document.getElementById("feedback");
  if (feedbackElem) {
    feedbackElem.textContent = "";
    feedbackElem.className = "";
  }

  // 結果テーブルの更新
  const resultsPage = document.getElementById("resultsPage");
  const resultsTableBody = document.querySelector("#resultsTable tbody");
  resultsTableBody.innerHTML = "";

  allLogs.forEach((log) => {
    const tr = document.createElement("tr");

    const tdTask = document.createElement("td");
    tdTask.textContent = log.taskIndex;
    tr.appendChild(tdTask);

    const tdCorrect = document.createElement("td");
    tdCorrect.textContent = log.correctItem;
    tr.appendChild(tdCorrect);

    const tdTime = document.createElement("td");
    tdTime.textContent = parseFloat(log.totalTime).toFixed(2) + "s";
    tr.appendChild(tdTime);

    const tdError = document.createElement("td");
    tdError.textContent = log.errorCount;
    tr.appendChild(tdError);

    const tdTimeout = document.createElement("td");
    tdTimeout.textContent = log.timedOut ? "Yes" : "No";
    tr.appendChild(tdTimeout);

    const tdEasing = document.createElement("td");
    tdEasing.textContent = log.usedEasing;
    tr.appendChild(tdEasing);

    resultsTableBody.appendChild(tr);
  });

  // 表示だけ
  resultsPage.style.display = "block";

  // デバッグ用：コンソールでも確認
  console.table(allLogs);
}

function showRewardScreen() {
  clearTimeout(timeoutId);
  timeoutId = null;

  // オーバーレイ＆UI非表示
  const taskEndOverlay = document.getElementById("taskEndOverlay");
  if (taskEndOverlay) taskEndOverlay.classList.add("hidden");
  document.querySelector('.config-area').style.display = "none";
  document.querySelector('.content-wrapper').style.display = "none";
  document.getElementById("resultsPage").style.display = "none";

  // === 基本統計 ===
  const totalTasks = allLogs.length;
  const correctTasks = allLogs.filter(log => !log.timedOut && log.errorCount === 0).length;
  const accuracy = totalTasks ? ((correctTasks / totalTasks) * 100).toFixed(1) + '%' : '0%';
  const totalTime = allLogs.reduce((sum, log) => sum + parseFloat(log.totalTime), 0);
  const averageTime = totalTasks ? (totalTime / totalTasks).toFixed(2) + 's' : '0.00s';

  document.getElementById("accuracyValue").textContent = accuracy;
  document.getElementById("averageTime").textContent = averageTime;

  // === イージングごとの統計 ===
  const easingStats = {};
  allLogs.forEach(log => {
    const easing = log.usedEasing;
    if (!easingStats[easing]) easingStats[easing] = { total: 0, correct: 0, totalTime: 0 };
    easingStats[easing].total++;
    // 🌟「一度でも間違えたら不正解」
    if (!log.timedOut && log.errorCount === 0) easingStats[easing].correct++;
    easingStats[easing].totalTime += parseFloat(log.totalTime);
  });

  // MVPイージング判定＆テーブル生成
  let bestEasing = null;
  let bestScore = -1;
  let tableHtml = '<table style="margin:0 auto; border-collapse:collapse; min-width:300px;">';
  tableHtml += '<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ccc;">イージング</th><th style="padding:8px; border:1px solid #ccc;">正解率</th><th style="padding:8px; border:1px solid #ccc;">平均時間</th></tr>';
  Object.keys(easingStats).forEach(easing => {
    const stat = easingStats[easing];
    const accuracy = stat.total > 0 ? (stat.correct / stat.total * 100).toFixed(1) : '0.0';
    const avgTime = stat.total > 0 ? (stat.totalTime / stat.total).toFixed(2) : '0.00';
    const score = parseFloat(accuracy);
    if (score > bestScore) {
      bestScore = score;
      bestEasing = easing;
    }
    tableHtml += `<tr><td style="padding:8px; border:1px solid #ccc;">${easing}</td><td style="padding:8px; border:1px solid #ccc;">${accuracy}%</td><td style="padding:8px; border:1px solid #ccc;">${avgTime}s</td></tr>`;
  });
  tableHtml += '</table>';
  document.getElementById("easingStatsTable").innerHTML = tableHtml;
  document.getElementById("bestEasing").textContent = bestEasing || "-";

  // === 追加集計 ===
  // 有効なタスク（タイムアウトやエラーなしのみ）
  const validLogs = allLogs.filter(log => !log.timedOut && log.errorCount === 0);

  // 最速タスク
  let fastestTask = null;
  let fastestTime = Infinity;
  validLogs.forEach(log => {
    const time = parseFloat(log.totalTime);
    if (time < fastestTime) {
      fastestTime = time;
      fastestTask = log;
    }
  });
  const fastestTaskTime = fastestTask ? fastestTask.totalTime + 's' : '-';

  // 総クリック数
  const totalClicks = allLogs.reduce((sum, log) => sum + (log.clicks ? log.clicks.length : 0), 0);

  // メニュー移動距離
  const totalMenuTravel = allLogs.reduce((sum, log) => sum + (log.menuTravelDistance || 0), 0);

  // 初回クリック平均
  const validFirstClicks = allLogs.filter(log => typeof log.firstClickTime === 'number');
  const avgFirstClick = validFirstClicks.length
    ? (validFirstClicks.reduce((sum, log) => sum + log.firstClickTime, 0) / validFirstClicks.length).toFixed(2) + 's'
    : '-';

  // === HTMLに反映 ===
  document.getElementById("fastestTask").textContent = fastestTaskTime;
  document.getElementById("totalClicks").textContent = totalClicks;
  document.getElementById("menuTravelDistance").textContent = totalMenuTravel;
  document.getElementById("avgFirstClick").textContent = avgFirstClick;

  // 「アンケートへ進む」ボタン
  const continueButton = document.getElementById("continueButton");
  if (continueButton) {
    continueButton.onclick = submitToNetlify;
  }

  // リワード画面表示
  document.getElementById("rewardScreen").classList.add("active");
}


/***********************
イージング関数＆サブメニューのアニメーション
***********************/

function updateEasingFunction() {
  const easingSelect = document.getElementById("easingSelect");
  const selectedEasing = easingSelect.value;
  document.documentElement.style.setProperty("--submenu-easing", selectedEasing);
}

function animateSubmenu(targetSubmenu) {
  if (!targetSubmenu) return;
  const level = getMenuLevel(targetSubmenu);

  // 既に開いてるサブメニューがあれば同時に閉じる
  if (currentlyOpenMenus[level] && currentlyOpenMenus[level] !== targetSubmenu) {
    // 閉じる
    currentlyOpenMenus[level].classList.remove("open");
  }
  // 開く
  targetSubmenu.classList.add("open");
  currentlyOpenMenus[level] = targetSubmenu;
  updateEasingFunction();
}

function openSubmenu(submenu, level) {
  closeSubmenuAtLevel(level);
  submenu.classList.add("open");
  currentlyOpenMenus[level] = submenu;
  updateEasingFunction();
}

function toggleSubmenu(submenu, level) {
  const isOpen = submenu.classList.contains("open");
  closeSubmenuAtLevel(level);
  if (!isOpen) openSubmenu(submenu, level);
}

function closeSubmenuAtLevel(level) {
  if (currentlyOpenMenus[level]) {
    closeSubmenuWithAnimation(currentlyOpenMenus[level]);
    currentlyOpenMenus[level] = null;
  }
}

function closeAllSubmenus() {
  document.querySelectorAll(".submenu").forEach((ul) => {
    ul.classList.remove("open");
  });
  currentlyOpenMenus = [];
}

function closeSubmenuWithAnimation(submenu, callback) {
  submenu.classList.remove("open");
  submenu.addEventListener(
    "transitionend",
    function handler() {
      submenu.removeEventListener("transitionend", handler);
      isAnimating = false;
      if (callback) callback();
    },
    { once: true }
  );
}

function getMenuLevel(submenu) {
  let level = 0;
  let parent = submenu.parentElement;
  while (parent && parent.parentElement) {
    if (parent.parentElement.classList.contains("submenu")) {
      level++;
    }
    parent = parent.parentElement;
  }
  return level;
}

/***********************
カテゴリ探索系（パスや深さ取得）
***********************/

function getAllLeafNames(categories) {
  let result = [];
  categories.forEach((cat) => {
    if (cat.subcategories && cat.subcategories.length > 0) {
      result = result.concat(getAllLeafNames(cat.subcategories));
    } else {
      if (cat.name) result.push(cat.name);
    }
  });
  return result;
}

function getCategoryDepthByName(categories, targetName, depth = 0) {
  for (const cat of categories) {
    if (cat.name === targetName) {
      return depth;
    }
    if (cat.subcategories && cat.subcategories.length > 0) {
      const found = getCategoryDepthByName(cat.subcategories, targetName, depth + 1);
      if (found !== -1) return found;
    }
  }
  return -1;
}

function findPathToLeaf(categories, targetName, currentPath = []) {
  for (const cat of categories) {
    const newPath = [...currentPath, cat.name];
    if (cat.name === targetName) {
      return newPath;
    }
    if (cat.subcategories && cat.subcategories.length > 0) {
      const subResult = findPathToLeaf(cat.subcategories, targetName, newPath);
      if (subResult) {
        return subResult;
      }
    }
  }
  return null;
}

/***********************
（オプション）ファイルダウンロード例
***********************/

function downloadResultsAsJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `results_participant_${data.participantId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getLeafNamesWithDepthAndSiblingCount(categories, targetDepth, siblingCount) {
  let result = [];
  function helper(cats, depth, parentSubCount) {
    cats.forEach((cat) => {
      if (cat.subcategories && cat.subcategories.length > 0) {
        helper(cat.subcategories, depth + 1, cat.subcategories.length);
      } else {
        if (depth === targetDepth && parentSubCount === siblingCount) {
          result.push(cat.name);
        }
      }
    });
  }
  helper(categories, 0, 0);
  return result;
}

/***********************
DOMContentLoaded
***********************/

document.addEventListener("DOMContentLoaded", () => {
  // ▼ 同意画面の設定
  const consentOverlay = document.getElementById("consentOverlay");
  const agreeBtn = document.getElementById("agreeBtn");
  const disagreeBtn = document.getElementById("disagreeBtn");

  agreeBtn.addEventListener("click", () => {
    consentOverlay.classList.add("hidden");
  });

  disagreeBtn.addEventListener("click", () => {
    alert("同意いただけない場合は実験に参加できません。");
  });

  // ▼ 説明用オーバーレイ生成
  let tutorialIntroOverlay = null;
  function createTutorialIntroOverlay() {
    const template = document.getElementById("tutorial-intro-overlay-template");
    if (!template) return null;
    const overlay = document.createElement("div");
    overlay.classList.add("overlay", "hidden");
    overlay.appendChild(template.content.cloneNode(true));

    overlay.querySelector("#tutorialIntroCloseBtn").addEventListener("click", () => {
      overlay.classList.add("hidden");
      // オーバーレイ閉じたら confirm ダイアログ
      if (confirm("チュートリアルを開始しますか？")) {
        startTutorial();
        startTutorialBtn.disabled = true;
        startTaskBtn.disabled = true;
      } else {
        // キャンセル時はボタン再有効化
        startTutorialBtn.disabled = false;
        startTaskBtn.disabled = false;
      }
    });
    return overlay;
  }

  // ▼ オーバーレイをbodyに追加
  tutorialIntroOverlay = createTutorialIntroOverlay();
  if (tutorialIntroOverlay) {
    document.body.appendChild(tutorialIntroOverlay);
  }

  // ▼ チュートリアル/タスク開始ボタン取得
  startTutorialBtn = document.getElementById("startTutorialBtn");
  startTaskBtn = document.getElementById("taskStartBtn");

  // ▼ チュートリアルボタンの挙動を上書き
  if (startTutorialBtn) {
    startTutorialBtn.addEventListener("click", () => {
      // まず説明オーバーレイを表示
      if (tutorialIntroOverlay) {
        tutorialIntroOverlay.classList.remove("hidden");
      }
      // ボタンを一時的に無効化
      startTutorialBtn.disabled = true;
      if (startTaskBtn) startTaskBtn.disabled = true;
    });
  }

  // ▼ タスク開始ボタン（既存のまま）
  if (startTaskBtn) {
    startTaskBtn.addEventListener("click", () => {
      if (!confirm("タスクを開始しますか？ 制限時間は1タスク当たり15秒です")) return;
      startTask();
      startTaskBtn.disabled = true;
      if (startTutorialBtn) startTutorialBtn.disabled = true;
      document.getElementById("menu-placeholder").style.display = "block";
    });
  }

  // ▼ タスク終了オーバーレイの設定（テンプレートから生成）
  const taskEndOverlay = document.getElementById("taskEndOverlay");
  if (taskEndOverlay) {
    const taskEndTemplate = document.getElementById("task-end-overlay-template");
    if (taskEndTemplate) {
      taskEndOverlay.appendChild(taskEndTemplate.content.cloneNode(true));
    }

    const continueTaskBtn = taskEndOverlay.querySelector("#continueTaskBtn");
    if (continueTaskBtn) {
      continueTaskBtn.addEventListener("click", () => {
        // ★ 最初にフィードバックをクリア
        const feedbackElem = document.getElementById("feedback");
        feedbackElem.textContent = "";
        feedbackElem.className = "";

        // タスク終了アンケートの内容を、今のタスクのログに統合する
        const animationEaseRating = taskEndOverlay.querySelector('input[name="animation-ease-rating"]:checked')?.value || null;
        const taskDifficultyRating = taskEndOverlay.querySelector('input[name="task-difficulty-rating"]:checked')?.value || null;
        const animationDifferenceRating = taskEndOverlay.querySelector('input[name="animation-difference-rating"]:checked')?.value || null;

        if (!animationEaseRating || !taskDifficultyRating || !animationDifferenceRating) {
          alert("タスクアンケートの全ての項目に回答してください。");
          return;
        }

        const taskComments = taskEndOverlay.querySelector("#task-comments").value;

        // すでに checkAnswer() or handleTimeout() で allLogs に本タスク分はpush済み
        // その「最後のログ」に対してアンケート結果を追加
        const lastLog = allLogs[allLogs.length - 1];
        if (lastLog && lastLog.taskIndex === currentTaskIndex) {
          lastLog.animationEaseRating = animationEaseRating;
          lastLog.taskDifficultyRating = taskDifficultyRating;
          lastLog.animationDifferenceRating = animationDifferenceRating;
          lastLog.comments = taskComments;
          lastLog.timestamp = new Date().toISOString();
        } else {
          allLogs.push({
            taskIndex: currentTaskIndex,
            animationEaseRating,
            taskDifficultyRating,
            animationDifferenceRating,
            comments: taskComments,
            timestamp: new Date().toISOString(),
          });
        }

        // 次に備えてラジオボタンやテキストをクリア
        taskEndOverlay.querySelectorAll('input[type="radio"]').forEach((input) => {
          input.checked = false;
        });
        const taskCommentsElem = taskEndOverlay.querySelector("#task-comments");
        if (taskCommentsElem) {
          taskCommentsElem.value = "";
        }

        // タスク完了 or 続行
        const btnText = continueTaskBtn.textContent.trim();
        if (btnText === "結果へ進む") {
          if (!confirm("結果に進みますか？")) return;
          taskEndOverlay.classList.add("hidden");
          showRewardScreen();
        } else if (btnText === "次へ進む" || btnText === "次のタスクへ") {
          if (!confirm("次のタスクに進みますか？")) return;
          taskEndOverlay.classList.add("hidden");
          startNextTask();
        }
      });
    }
  }

  // ▼ チュートリアル/タスク開始ボタン
  const menuPlaceholder = document.getElementById("menu-placeholder");
  const easingSelect = document.getElementById("easingSelect");

  // ▼ メニュー生成
  // 例として "rakuten_categories_2_dummy.json" をfetch
  fetch("rakuten_categories_2_dummy.json")
    .then((res) => res.json())
    .then((data) => {
      categoriesData = data.categories;
      const menuRoot = document.createElement("ul");
      menuRoot.classList.add("menu");
      createMenuRecursive(categoriesData, menuRoot);
      menuPlaceholder.appendChild(menuRoot);

      // 🌟 固定タスクの商品がJSONに存在するか検証
      FIXED_TASKS.forEach((task, index) => {
        const path = findPathToLeaf(categoriesData, task.item);
        if (!path) {
          console.warn(`警告: タスク${index + 1}の商品「${task.item}」がメニューに見つかりませんでした！`);
        }
      });
    })
    .catch((err) => console.error("JSON読み込み失敗:", err));

  // ▼ イージング関数変更
  if (easingSelect) {
    easingSelect.addEventListener("change", updateEasingFunction);
  }

  // ▼ チュートリアルオーバーレイ作成＆追加
  tutorialOverlay = createTutorialOverlay();
  if (tutorialOverlay) {
    document.body.appendChild(tutorialOverlay);
  }

  // ▼ Netlifyフォーム用：URLパラメータのparticipant確認してフォームactionをカスタマイズ
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get("participant");
  if (pid) {
    // フォームの action 属性を "thank-you.html?participant=XXX" に更新
    const form = document.getElementById("netlifyForm");
    if (form) {
      form.action = "thank-you.html?participant=" + encodeURIComponent(pid);
    }
  }
});
