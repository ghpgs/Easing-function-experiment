/* ==========================
   ① 定数＆グローバル変数
========================== */
const MAX_TASKS = 2; // タスク回数
const TIME_LIMIT_MS = 2000; // タスク制限時間(ms)

// ---- ラテン方格 (5×5) 用の定義 ----
const EASING_FUNCS = ["easeInOutSine", "easeInOutQuad", "easeInOutCubic", "easeInOutQuint", "easeInOutExpo"];
const LATIN_SQUARE = [
  [0, 1, 2, 3, 4],
  [1, 2, 3, 4, 0],
  [2, 3, 4, 0, 1],
  [3, 4, 0, 1, 2],
  [4, 0, 1, 2, 3],
];

// 実験制御用
let currentTaskIndex = 0;
let startTime = 0; // タスク開始時刻
let errorCount = 0;
let timeoutId = null;
let allLogs = [];

// 「最初のクリック」が起きた秒数（タスク開始からの経過秒）
let firstClickTime = null;

// 1つのタスク中のクリック履歴
let clicksThisTask = [];

// ★追加ポイント：移動距離や滞在時間の管理
let menuTravelDistance = 0;
let lastClickTime = 0;
let lastClickDepth = 0;

// 多層メニュー (階層管理)
let currentlyOpenMenus = [];

// JSONデータ (メニュー用)
let categoriesData = [];

// タスク全体で使われるイージング
let currentTaskEasing = "";

// 正解アイテムまでのパス
let currentCorrectPath = [];

// ★アニメーション中かどうか
let isAnimating = false;

/* =============================
   ★ チュートリアル関連の変数
============================= */
let isTutorialActive = false; // trueの間は「チュートリアル中」
let tutorialTargetItem = "ビジネスノート"; // チュートリアルでクリックしてほしいアイテム
let tutorialOverlay = null; // チュートリアル完了用オーバーレイ

/* ==========================
   ② 参加者IDの生成＆URL付与
========================== */
function generateRandomParticipantId() {
  return Math.floor(Math.random() * 1000);
}
function setNewParticipantId() {
  const newId = generateRandomParticipantId();
  const newUrl = `${window.location.pathname}?participant=${newId}`;
  window.history.replaceState({}, "", newUrl);
  return newId;
}
const participantId = setNewParticipantId();
console.log("参加者ID:", participantId);

/* ==========================
   ③ DOM読み込み時の処理
========================== */
document.addEventListener("DOMContentLoaded", () => {
  // ---------- 同意画面オーバーレイ ----------
  const consentOverlay = document.getElementById("consentOverlay");
  const agreeBtn = document.getElementById("agreeBtn");
  const disagreeBtn = document.getElementById("disagreeBtn");

  agreeBtn.addEventListener("click", () => {
    consentOverlay.classList.add("hidden");
  });
  disagreeBtn.addEventListener("click", () => {
    alert("同意いただけない場合は実験に参加できません。");
  });

  // ---------- タスク終了オーバーレイ ----------
  const taskEndOverlay = document.getElementById("taskEndOverlay");
  const continueTaskBtn = document.getElementById("continueTaskBtn");
  continueTaskBtn.addEventListener("click", () => {
    taskEndOverlay.classList.add("hidden");
    startNextTask();
  });

  // ---------- HTML要素取得 (メインUI) ----------
  const menuPlaceholder = document.getElementById("menu-placeholder");
  const easingSelect = document.getElementById("easingSelect");

  // ▼ チュートリアル開始ボタン
  const startTutorialBtn = document.getElementById("startTutorialBtn");
  // ▼ 本番タスク開始ボタン (もとの taskStartBtn)
  const startTaskBtn = document.getElementById("taskStartBtn");

  const nextTaskBtn = document.getElementById("nextTaskBtn");
  const downloadAllLogsBtn = document.getElementById("downloadAllLogsBtn");

  // JSON読み込み＆メニュー生成
  fetch("menu_data.json")
    .then((res) => res.json())
    .then((data) => {
      categoriesData = data.categories;
      const menuRoot = document.createElement("ul");
      menuRoot.classList.add("menu");
      createMenuRecursive(categoriesData, menuRoot);
      menuPlaceholder.appendChild(menuRoot);
    })
    .catch((err) => console.error("JSON読み込み失敗:", err));

  // イージングセレクト
  easingSelect.addEventListener("change", updateEasingFunction);

  // ★ チュートリアル完了オーバーレイを生成
  tutorialOverlay = createTutorialOverlay();
  document.body.appendChild(tutorialOverlay);

  // 「チュートリアル開始」ボタン
  startTutorialBtn.addEventListener("click", () => {
    startTutorial();
    startTutorialBtn.disabled = true; // 多重クリック防止
  });

  // 「本番タスク開始」ボタン
  startTaskBtn.addEventListener("click", () => {
    // チュートリアルをやらなくても、本番に進める設計
    startTask();
    startTaskBtn.disabled = true; // 多重クリック防止
  });

  // 「次のタスクへ進む」ボタン
  nextTaskBtn.addEventListener("click", handleNextTask);

  // ログ一括ダウンロード
  downloadAllLogsBtn.addEventListener("click", handleDownloadAllLogs);
});

/* ==========================
   ④ メニュー生成 (再帰)
========================== */
function createMenuRecursive(categoryArray, parentUL) {
  categoryArray.forEach((cat) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = cat.name;
    btn.classList.add("menu-item");

    if (cat.subcategories && cat.subcategories.length > 0) {
      // 親カテゴリ
      const subUl = document.createElement("ul");
      subUl.classList.add("submenu");
      createMenuRecursive(cat.subcategories, subUl);

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        recordClick(cat.name);

        // 本番タスク中のみエラー判定
        if (!isTutorialActive) {
          const currentDepth = getCategoryDepthByName(categoriesData, cat.name);
          if (currentDepth >= 1 && cat.name !== currentCorrectPath[currentDepth]) {
            errorCount++;
          }
        }

        // 開閉アニメ
        animateSubmenu(subUl);
      });

      li.appendChild(btn);
      li.appendChild(subUl);
    } else {
      // 葉ノード
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        recordClick(cat.name);

        if (isTutorialActive) {
          // チュートリアル回答チェック
          checkTutorialAnswer(cat.name);
        } else {
          // 本番タスク回答チェック
          checkAnswer(cat.name);
          closeAllSubmenus();
        }
      });
      li.appendChild(btn);
    }
    parentUL.appendChild(li);
  });
}

/* ==========================
   ⑤ クリック記録用関数
========================== */
function recordClick(categoryName) {
  const currentClickTime = performance.now();
  const currentDepth = getCategoryDepthByName(categoriesData, categoryName);

  // 最初のクリック時刻
  if (firstClickTime === null) {
    firstClickTime = (currentClickTime - startTime) / 1000;
  }

  // 滞在時間
  let stayTime = 0;
  if (lastClickTime !== 0) {
    stayTime = (currentClickTime - lastClickTime) / 1000;
  }

  // 階層移動距離
  menuTravelDistance += Math.abs(currentDepth - lastClickDepth);

  // クリック履歴に追加
  clicksThisTask.push({
    name: categoryName,
    depth: currentDepth,
    duringAnimation: isAnimating,
    stayTime: parseFloat(stayTime.toFixed(2)),
  });

  // 更新
  lastClickTime = currentClickTime;
  lastClickDepth = currentDepth;
}

/* ==========================
   ★ チュートリアル開始
========================== */
function startTutorial() {
  isTutorialActive = true;
  resetTaskVars();

  const taskInfo = document.getElementById("taskInfo");
  taskInfo.textContent = `【チュートリアル】「${tutorialTargetItem}」をクリックしてみてください。`;

  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";

  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    feedbackElem.textContent = "（チュートリアル：時間切れ？ もう一度トライ可能）";
    feedbackElem.classList.add("timeout");
  }, TIME_LIMIT_MS);

  startTime = performance.now();
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

  // 正解
  clearTimeout(timeoutId);
  feedbackElem.textContent = "チュートリアル：正解です！";
  feedbackElem.classList.remove("incorrect", "timeout");
  feedbackElem.classList.add("correct");

  closeAllSubmenus();
  tutorialOverlay.classList.remove("hidden");
}

/* ==========================
   ★ チュートリアル終了後 → 本番タスク
========================== */
function startTask() {
  isTutorialActive = false;
  allLogs = [];
  currentTaskIndex = 0;

  document.getElementById("resultsPage").style.display = "none";
  document.getElementById("nextTaskBtn").style.display = "none";

  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";

  startNextTask();
}

/* ==========================
   ⑥ 本番タスク開始
========================== */
function startNextTask() {
  currentTaskIndex++;
  if (currentTaskIndex > MAX_TASKS) {
    showResultsPage();
    return;
  }

  if (currentTaskIndex === MAX_TASKS) {
    document.getElementById("nextTaskBtn").style.display = "none";
  }

  resetTaskVars();
  closeAllSubmenus();
  clearTimeout(timeoutId);

  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";

  document.getElementById("nextTaskBtn").style.display = "none";

  // ラテン方格でイージング割り当て
  const rowIndex = participantId % 5;
  const colIndex = currentTaskIndex - 1;
  const easingIndex = LATIN_SQUARE[rowIndex][colIndex];
  currentTaskEasing = EASING_FUNCS[easingIndex];

  const assignedDropdownValue = `var(--${currentTaskEasing})`;
  const easingSelect = document.getElementById("easingSelect");
  for (const option of easingSelect.options) {
    if (option.value === assignedDropdownValue) {
      option.selected = true;
      break;
    }
  }
  updateEasingFunction();

  // お題をランダム選択
  const leafNames = getAllLeafNames(categoriesData);
  const targetItemName = leafNames[Math.floor(Math.random() * leafNames.length)];

  const taskInfo = document.getElementById("taskInfo");
  taskInfo.textContent = `タスク ${currentTaskIndex}/${MAX_TASKS}： 「${targetItemName}」をクリックしてください！`;

  startTime = performance.now();

  // 正解パスを探して保持
  currentCorrectPath = findPathToLeaf(categoriesData, targetItemName) || [];

  // タイムアウト
  timeoutId = setTimeout(() => {
    handleTimeout(targetItemName);
  }, TIME_LIMIT_MS);
}

/* ==========================
   ⑦ 正解チェック
========================== */
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

  // 正解
  feedbackElem.textContent = `正解です！\n時間:${totalTimeSec}s\nエラー:${errorCount}`;
  feedbackElem.className = "correct";

  const firstClickTimeSec = firstClickTime !== null ? parseFloat(firstClickTime.toFixed(2)) : "N/A";

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

  // タスク終了オーバーレイ
  const taskEndOverlay = document.getElementById("taskEndOverlay");
  const continueTaskBtn = document.getElementById("continueTaskBtn");
  if (currentTaskIndex === MAX_TASKS) {
    continueTaskBtn.textContent = "結果へ進む";
  } else {
    continueTaskBtn.textContent = "次のタスクへ";
  }
  taskEndOverlay.classList.remove("hidden");

  const nextTaskBtn = document.getElementById("nextTaskBtn");
  if (currentTaskIndex === MAX_TASKS) {
    nextTaskBtn.style.display = "none";
  } else {
    nextTaskBtn.style.display = "block";
  }
}

/* ==========================
   ⑨ タイムアウト
========================== */
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

  const taskEndOverlay = document.getElementById("taskEndOverlay");
  const continueTaskBtn = document.getElementById("continueTaskBtn");
  if (currentTaskIndex === MAX_TASKS) {
    continueTaskBtn.textContent = "結果に進む";
  } else {
    continueTaskBtn.textContent = "次のタスクへ";
  }
  taskEndOverlay.classList.remove("hidden");
}

/* ==========================
   ⑩ 次のタスクへ
========================== */
function handleNextTask() {
  document.getElementById("nextTaskBtn").style.display = "none";
  startNextTask();
}

/* ==========================
   ⑪ 全タスク終了
========================== */
function showResultsPage() {
  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";
  document.getElementById("nextTaskBtn").style.display = "none";

  const resultsPage = document.getElementById("resultsPage");
  const resultsTableBody = document.querySelector("#resultsTable tbody");
  const downloadAllLogsBtn = document.getElementById("downloadAllLogsBtn");

  resultsTableBody.innerHTML = "";

  allLogs.forEach((log) => {
    const tr = document.createElement("tr");

    const tdTask = document.createElement("td");
    tdTask.textContent = log.taskIndex;

    const tdCorrect = document.createElement("td");
    tdCorrect.textContent = log.correctItem;

    const tdTime = document.createElement("td");
    tdTime.textContent = parseFloat(log.totalTime).toFixed(2) + "s";

    const tdError = document.createElement("td");
    tdError.textContent = log.errorCount;

    const tdTimeout = document.createElement("td");
    tdTimeout.textContent = log.timedOut ? "Yes" : "No";

    tr.appendChild(tdTask);
    tr.appendChild(tdCorrect);
    tr.appendChild(tdTime);
    tr.appendChild(tdError);
    tr.appendChild(tdTimeout);

    resultsTableBody.appendChild(tr);
  });

  resultsPage.style.display = "block";
  downloadAllLogsBtn.style.display = "inline-block";
}

/* ==========================
   ⑫ ログ一括ダウンロード
========================== */
function handleDownloadAllLogs() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allLogs, null, 2));
  const fileName = `participant_${participantId}_logs.json`;
  const anchor = document.createElement("a");
  anchor.setAttribute("href", dataStr);
  anchor.setAttribute("download", fileName);
  anchor.click();
}

/* ==========================
   ⑬ イージング関数更新
========================== */
function updateEasingFunction() {
  const easingSelect = document.getElementById("easingSelect");
  const selectedEasing = easingSelect.value;
  document.documentElement.style.setProperty("--submenu-easing", selectedEasing);
}

/* ==========================
   ⑭ メニュー開閉アニメ (多層)
========================== */
function animateSubmenu(targetSubmenu) {
  if (!targetSubmenu) return;
  const level = getMenuLevel(targetSubmenu);
  isAnimating = true;

  if (currentlyOpenMenus[level] && currentlyOpenMenus[level] !== targetSubmenu) {
    closeSubmenuWithAnimation(currentlyOpenMenus[level], () => {
      openSubmenu(targetSubmenu, level);
    });
  } else {
    toggleSubmenu(targetSubmenu, level);
  }
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

/* ==========================
   ⑮ 葉ノードのname全取得
========================== */
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

/* ==========================
   ⑯ name → depth
========================== */
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

/* ==========================
   ⑰ ターゲットアイテムまでのパス (DFS)
========================== */
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

/* ==========================
   ⑱ アニメを飛ばして即開
========================== */
function openMenuImmediately(submenu) {
  submenu.style.transition = "none";
  submenu.classList.add("open");
  currentlyOpenMenus[getMenuLevel(submenu)] = submenu;
  isAnimating = false;
  requestAnimationFrame(() => {
    submenu.style.transition = "";
  });
}

/* ==========================
   ★ 変数リセット関数
========================== */
function resetTaskVars() {
  clicksThisTask = [];
  errorCount = 0;
  menuTravelDistance = 0;
  lastClickTime = 0;
  lastClickDepth = 0;
  firstClickTime = null;
}

/* ==========================
   ★ チュートリアル完了オーバーレイ
========================== */
function createTutorialOverlay() {
  const overlay = document.createElement("div");
  overlay.classList.add("overlay", "hidden");
  overlay.innerHTML = `
    <div class="overlay-content">
      <h2>チュートリアル完了</h2>
      <p>ご理解ありがとうございます。<br>チュートリアルは以上です。</p>
      <button id="closeTutorialBtn">閉じる</button>
    </div>
  `;
  // チュートリアルを閉じる(本番タスク開始は別ボタンに任せる)
  overlay.querySelector("#closeTutorialBtn").addEventListener("click", () => {
    overlay.classList.add("hidden");
  });
  return overlay;
}
