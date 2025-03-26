/***********************
  定数＆グローバル変数
***********************/
const MAX_TASKS = 2; // タスク回数
const TIME_LIMIT_MS = 2000; // タスク制限時間(ms)
const EASING_FUNCS = ["easeInOutSine", "easeInOutQuad", "easeInOutCubic", "easeInOutQuint", "easeInOutExpo"];
const LATIN_SQUARE = [
  [0, 1, 2, 3, 4],
  [1, 2, 3, 4, 0],
  [2, 3, 4, 0, 1],
  [3, 4, 0, 1, 2],
  [4, 0, 1, 2, 3],
];

let currentTaskIndex = 0;
let startTime = 0;
let errorCount = 0;
let timeoutId = null;
let allLogs = [];
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
let tutorialTargetItem = "最新型ドライバー";
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
  const newUrl = `${window.location.pathname}?participant=${newId}`;
  window.history.replaceState({}, "", newUrl);
  return newId;
}

const participantId = setNewParticipantId();
console.log("参加者ID:", participantId);

/***********************
  HTMLテンプレート取得関数（チュートリアルオーバーレイ用）
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
  DOMContentLoaded イベント
***********************/
document.addEventListener("DOMContentLoaded", () => {
  // 同意画面の設定
  const consentOverlay = document.getElementById("consentOverlay");
  const agreeBtn = document.getElementById("agreeBtn");
  const disagreeBtn = document.getElementById("disagreeBtn");

  agreeBtn.addEventListener("click", () => {
    consentOverlay.classList.add("hidden");
  });
  disagreeBtn.addEventListener("click", () => {
    alert("同意いただけない場合は実験に参加できません。");
  });

  // タスク終了オーバーレイの設定（テンプレートから生成）
  const taskEndOverlay = document.getElementById("taskEndOverlay");
  if (taskEndOverlay) {
    const taskEndTemplate = document.getElementById("task-end-overlay-template");
    if (taskEndTemplate) {
      taskEndOverlay.appendChild(taskEndTemplate.content.cloneNode(true));
    }
    const continueTaskBtn = taskEndOverlay.querySelector("#continueTaskBtn");
    if (continueTaskBtn) {
      continueTaskBtn.addEventListener("click", () => {
        const taskEaseRating = taskEndOverlay.querySelector('input[name="task-ease-rating"]:checked')?.value || null;
        const animationRating = taskEndOverlay.querySelector('input[name="animation-rating"]:checked')?.value || null;
        if (!taskEaseRating || !animationRating) {
          alert("タスクアンケートの全ての項目に回答してください。");
          return;
        }
        const taskComments = taskEndOverlay.querySelector("#task-comments").value;
        const surveyData = {
          type: "task",
          taskIndex: currentTaskIndex,
          easeRating: taskEaseRating,
          animationRating: animationRating,
          comments: taskComments,
          usedEasing: currentTaskEasing,
          timestamp: new Date().toISOString(),
        };
        if (!window.surveyLogs) window.surveyLogs = [];
        window.surveyLogs.push(surveyData);
        console.log("タスクアンケート回答:", surveyData);
        taskEndOverlay.querySelectorAll('input[type="radio"]').forEach((input) => {
          input.checked = false;
        });
        const taskCommentsElem = taskEndOverlay.querySelector("#task-comments");
        if (taskCommentsElem) {
          taskCommentsElem.value = "";
        }
        const btnText = continueTaskBtn.textContent.trim();
        if (btnText === "結果へ進む") {
          taskEndOverlay.classList.add("hidden");
          showResultsPage();
        } else {
          if (!confirm("次のタスクに進みますか？")) return;
          taskEndOverlay.classList.add("hidden");
          startNextTask();
        }
      });
    }
  }

  startTutorialBtn = document.getElementById("startTutorialBtn");
  startTaskBtn = document.getElementById("taskStartBtn");
  const menuPlaceholder = document.getElementById("menu-placeholder");
  const easingSelect = document.getElementById("easingSelect");

  fetch("rakuten_categories.json")
    .then((res) => res.json())
    .then((data) => {
      categoriesData = data.categories;
      const menuRoot = document.createElement("ul");
      menuRoot.classList.add("menu");
      createMenuRecursive(categoriesData, menuRoot);
      menuPlaceholder.appendChild(menuRoot);
    })
    .catch((err) => console.error("JSON読み込み失敗:", err));

  easingSelect.addEventListener("change", updateEasingFunction);

  tutorialOverlay = createTutorialOverlay();
  document.body.appendChild(tutorialOverlay);

  startTutorialBtn.addEventListener("click", () => {
    if (!confirm("チュートリアルを開始しますか？")) return;
    startTutorial();
    startTutorialBtn.disabled = true;
    startTaskBtn.disabled = true;
  });

  startTaskBtn.addEventListener("click", () => {
    if (!confirm("タスクを開始しますか？")) return;
    startTask();
    startTaskBtn.disabled = true;
    startTutorialBtn.disabled = true;
  });
});

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

  menuTravelDistance += Math.abs(currentDepth - lastClickDepth);
  clicksThisTask.push({
    name: categoryName,
    depth: currentDepth,
    duringAnimation: isAnimating,
    stayTime: parseFloat(stayTime.toFixed(2)),
  });

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
  taskInfo.textContent = `【チュートリアル】「${tutorialTargetItem}」をクリックしてください。`;
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
  clearTimeout(timeoutId);
  feedbackElem.textContent = "チュートリアル：正解です！";
  feedbackElem.classList.remove("incorrect", "timeout");
  feedbackElem.classList.add("correct");
  closeAllSubmenus();
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
  currentTaskIndex++;
  if (currentTaskIndex > MAX_TASKS) {
    showResultsPage();
    return;
  }
  resetTaskVars();
  closeAllSubmenus();
  clearTimeout(timeoutId);
  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";
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
  const leafNames = getAllLeafNames(categoriesData);
  const targetItemName = leafNames[Math.floor(Math.random() * leafNames.length)];
  const taskInfo = document.getElementById("taskInfo");
  taskInfo.textContent = `タスク ${currentTaskIndex}/${MAX_TASKS}： 「${targetItemName}」をクリックしてください。`;
  startTime = performance.now();
  currentCorrectPath = findPathToLeaf(categoriesData, targetItemName) || [];
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
  feedbackElem.textContent = "正解です！";
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
  const taskEndOverlay = document.getElementById("taskEndOverlay");
  const continueTaskBtn = taskEndOverlay.querySelector("#continueTaskBtn");
  if (currentTaskIndex === MAX_TASKS) {
    continueTaskBtn.textContent = "結果へ進む";
  } else {
    continueTaskBtn.textContent = "次のタスクへ";
  }
  taskEndOverlay.classList.remove("hidden");
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
  結果表示／自動送信
***********************/
function showResultsPage() {
  // フィードバック欄のクリア
  const feedbackElem = document.getElementById("feedback");
  feedbackElem.textContent = "";
  feedbackElem.className = "";

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

  resultsPage.style.display = "block";

  // 自動送信処理：URLSearchParams を使用して form 形式でデータ送信する
  const params = new URLSearchParams();
  params.append("participantId", participantId);
  params.append("taskLogs", JSON.stringify(allLogs));
  params.append("surveyLogs", JSON.stringify(window.surveyLogs || []));

  fetch("https://script.google.com/macros/s/AKfycby-N7Be_9IY3mcA6MYjNKc9WsOCoG8fKUzpDDJEJ-OxhHq4QqdVkcisFUuY57iquppp/exec", {
    method: "POST",
    // ヘッダーを明示的に設定しないことで、単純リクエストとして送信される
    body: params,
  })
    .then((res) => {
      // 単純リクエストの場合、レスポンスが opaque になる可能性があるので、
      // ここでは送信完了のログだけ出す
      console.log("データ送信リクエストを送信しました");
    })
    .catch((err) => {
      console.error("エラーが発生しました：", err);
    });
}

/***********************
  イージング関数更新＆メニューアニメーション
***********************/
function updateEasingFunction() {
  const easingSelect = document.getElementById("easingSelect");
  const selectedEasing = easingSelect.value;
  document.documentElement.style.setProperty("--submenu-easing", selectedEasing);
}

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

function openMenuImmediately(submenu) {
  submenu.style.transition = "none";
  submenu.classList.add("open");
  currentlyOpenMenus[getMenuLevel(submenu)] = submenu;
  isAnimating = false;
  requestAnimationFrame(() => {
    submenu.style.transition = "";
  });
}
