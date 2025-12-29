/**
 * スケジュール作成画面のメインロジック
 * 時間帯の選択とスケジュール作成を管理
 */

// =====================
// 状態管理
// =====================
/** 選択中の時間帯のキー集合 */
const state = new Set();

/** PCでのドラッグ中かどうか（グローバルフラグ） */
window.isDrag = false;

/** 追加モードか削除モードか（true: 追加, false: 削除） */
let dragAdd = true;

/** セッションストレージから設定を取得 */
const setupData = JSON.parse(sessionStorage.getItem("scheduleSetup") || "{}");

/** コピーした週の選択状態を保存 */
let copiedWeekState = null;

/**
 * 通知メッセージを表示（数秒後に自動で消える）
 * @param {string} message - 表示するメッセージ
 */
function showNotification(message) {
    const notification = document.getElementById("notification");
    if (!notification) return;

    notification.textContent = message;
    notification.classList.add("show");

    // 2秒後に自動で消える
    setTimeout(() => {
        notification.classList.remove("show");
    }, 2000);
}

/**
 * ペーストボタンの有効/無効を更新
 */
function updatePasteButton() {
    const pasteBtn = document.querySelector(".paste-btn");
    if (!pasteBtn) return;

    if (copiedWeekState && copiedWeekState.state.size > 0) {
        pasteBtn.classList.remove("disabled");
    } else {
        pasteBtn.classList.add("disabled");
    }
}

// =====================
// グリッド再構築
// =====================
/**
 * グリッドを再構築し、各セルにイベントハンドラーを設定
 * @param {HTMLElement} grid - グリッド要素
 */
function rebuildSingle(grid) {
    // 設定から時間の区切り幅を取得
    const timeInterval = setupData.timeInterval || 30;

    // 1日のスロット数を計算（24時間 = 1440分）
    const slotsPerDay = Math.floor(1440 / timeInterval);
    const maxSlot = slotsPerDay - 1;

    buildGrid(grid, null, (td, key) => {
        // 既に選択されているセルにはselectedクラスを追加
        if (state.has(key)) {
            td.classList.add("selected");
        }

        // タッチ/マウスイベントハンドラーをアタッチ
        attachTouchHandler(td, key, {
            onToggle: (td, key, isAdd) => {
                dragAdd = isAdd;
                toggle(td, key);
            },
            getState: (key) => state.has(key),
            onSwipe: (direction) => {
                if (direction === "right" && hasPrevWeek()) {
                    prevWeek();
                } else if (direction === "left" && hasNextWeek()) {
                    nextWeek();
                }
            },
            hasPrevWeek: hasPrevWeek,
            hasNextWeek: hasNextWeek
        });

        // PCでのマウスドラッグ開始処理
        td.onmousedown = (e) => {
            e.preventDefault();
            window.isDrag = true;
            dragAdd = !state.has(key);
            toggle(td, key);
        };

        // PCでのマウスオーバー処理
        td.onmouseover = () => {
            if (window.isDrag) {
                toggle(td, key);
            }
        };

        // PCでのマウスアップ処理
        td.onmouseup = () => {
            window.isDrag = false;
        };
    }, 0, maxSlot, timeInterval);

    updateWeekButtons();
}

// =====================
// グローバルマウスアップ処理
// =====================
document.addEventListener("mouseup", () => {
    window.isDrag = false;
});

// =====================
// セル状態の切り替え
// =====================
/**
 * セルの選択状態を切り替える
 * @param {HTMLElement} td - セル要素
 * @param {string} key - セルのキー
 */
function toggle(td, key) {
    if (!td) return;

    if (dragAdd) {
        state.add(key);
        td.classList.add("selected");
    } else {
        state.delete(key);
        td.classList.remove("selected");
    }
}

// =====================
// コピー/ペースト機能
// =====================
/**
 * 現在の週の選択状態をコピー
 */
function copyCurrentWeek() {
    // 現在の週の開始日と終了日を取得
    const weekStart = currentStartDate;
    const weekEnd = addDays(weekStart, 6);

    // 現在の週に属する選択状態のみを抽出
    const weekState = new Set();
    for (const key of state) {
        // キーから日付部分を取得（例: "2024-01-01-0" -> "2024-01-01"）
        const dateStr = key.split("-").slice(0, 3).join("-");

        // 日付文字列を直接比較
        if (dateStr >= weekStart && dateStr <= weekEnd) {
            // 週の開始日からの日数を計算（0-6の範囲）
            let dayIndex = -1;
            for (let i = 0; i < 7; i++) {
                const checkDate = addDays(weekStart, i);
                if (checkDate === dateStr) {
                    dayIndex = i;
                    break;
                }
            }

            // 日付が見つかった場合のみ保存
            if (dayIndex >= 0) {
                // スロット番号を取得
                const slot = key.split("-")[3];
                weekState.add(`${dayIndex}-${slot}`);
            }
        }
    }

    copiedWeekState = {
        weekStart: weekStart,
        state: weekState
    };

    // ペーストボタンの表示を更新
    updatePasteButton();

    // 通知を表示
    showNotification("コピーしました");
}

/**
 * コピーした選択状態を現在の週にペースト
 */
function pasteCurrentWeek() {
    if (!copiedWeekState || copiedWeekState.state.size === 0) {
        return;
    }

    // 現在の週の範囲を取得
    const weekStart = currentStartDate;

    // 現在の週の選択状態をクリア（現在の週に属するもののみ）
    const weekEnd = addDays(weekStart, 6);
    const keysToRemove = [];
    for (const key of state) {
        // キーから日付部分を取得
        const dateStr = key.split("-").slice(0, 3).join("-");

        // 日付文字列を直接比較
        if (dateStr >= weekStart && dateStr <= weekEnd) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => state.delete(key));

    // コピーした状態を現在の週に適用
    for (const relativeKey of copiedWeekState.state) {
        const [dayIndex, slot] = relativeKey.split("-");
        const targetDate = addDays(weekStart, parseInt(dayIndex));
        const key = `${targetDate}-${slot}`;
        state.add(key);
    }

    // グリッドを再構築して選択状態を反映
    rebuildSingle(gridNow);
}

// =====================
// スケジュール作成
// =====================
/**
 * 選択した時間帯でスケジュールを作成
 * 少なくとも1マス選択されている必要がある
 */
function create() {
    if (state.size === 0) {
        alert("少なくとも1マス選択してください！");
        return;
    }

    // 設定の確認（timeIntervalは必須）
    if (!setupData.timeInterval) {
        alert("時間の区切り幅が設定されていません。最初からやり直してください。");
        window.location.href = "/setup";
        return;
    }

    fetch("/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            slots: Array.from(state),
            title: setupData.title,
            time_interval: setupData.timeInterval,
            creator_password: setupData.creatorPassword
        })
    })
        .then(r => r.json())
        .then(d => {
            // セッションストレージをクリア
            sessionStorage.removeItem("scheduleSetup");
            location.href = `/${d.schedule_id}/summary`;
        });
}

// =====================
// 初期化
// =====================
// DOMContentLoadedイベントで初期化を実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

function initialize() {
    // セッションストレージに設定があるか確認（timeIntervalは必須）
    if (!setupData.timeInterval) {
        // 設定がない場合はsetup画面にリダイレクト
        window.location.href = "/setup";
        return;
    }

    // 初期描画
    try {
        buildAllWeeks(rebuildSingle);
        // 初期状態でペーストボタンを非表示にする
        updatePasteButton();
    } catch (error) {
        console.error("グリッドの初期化エラー:", error);
        alert("エラーが発生しました。ページを再読み込みしてください。");
    }
}
