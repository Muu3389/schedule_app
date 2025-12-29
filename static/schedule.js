/**
 * スケジュール回答画面のメインロジック
 * 都合が悪い時間帯とわからない時間帯の選択を管理
 */

// =====================
// DOM要素の取得
// =====================
const grid = document.getElementById("grid");
const badBtn = document.getElementById("badBtn");
const unknownBtn = document.getElementById("unknownBtn");

// =====================
// 状態管理
// =====================
/** 現在の選択モード（"bad" または "unknown"） */
let mode = "bad";

/** PCでのドラッグ中かどうか（グローバルフラグ） */
window.isDrag = false;

/** 追加モードか削除モードか（true: 追加, false: 削除） */
let dragAdd = true;

/** 選択状態（key -> "bad" | "unknown"） */
const state = {};

/** スロット範囲の計算 */
const { min, max } = calcSlotRange(AVAILABLE_SLOTS);

// =====================
// 既存回答の復元
// =====================
if (EDIT_NAME) {
    const nameInput = document.getElementById("name");
    nameInput.value = EDIT_NAME;
    nameInput.disabled = true;

    PREV_ANSWERS.forEach(a => {
        const key = `${a.day}-${a.slot}`;
        state[key] = a.status;
    });
}

// =====================
// グリッド再構築
// =====================
/**
 * グリッドを再構築し、各セルにイベントハンドラーを設定
 * @param {HTMLElement} grid - グリッド要素
 */
function rebuildSingle(grid) {
    buildGrid(grid, AVAILABLE_SLOTS, (td, key) => {
        // 有効マスにはavailableクラスを追加
        td.classList.add("available");

        // 既に選択されているセルには状態クラスを追加
        if (state[key]) {
            td.classList.remove("available");
            td.classList.add(state[key]);
        }

        // タッチ/マウスイベントハンドラーをアタッチ
        attachTouchHandler(td, key, {
            onToggle: (td, key, isAdd) => {
                dragAdd = isAdd;
                toggle(td, key);
            },
            getState: (key) => Object.hasOwn(state, key),
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
            dragAdd = !state[key];
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
    }, min, max, TIME_INTERVAL);

    updateWeekButtons();
}

// =====================
// セル状態の切り替え
// =====================
/**
 * セルの選択状態を切り替える
 * @param {HTMLElement} td - セル要素
 * @param {string} key - セルのキー
 */
function toggle(td, key) {
    td.classList.remove("bad", "unknown", "available");

    if (dragAdd) {
        state[key] = mode;
        td.classList.add(mode);
    } else {
        delete state[key];
        td.classList.add("available");
    }
}

// =====================
// グローバルマウスアップ処理
// =====================
document.addEventListener("mouseup", () => {
    window.isDrag = false;
});

// =====================
// モード設定
// =====================
/**
 * 選択モードを設定（"bad" または "unknown"）
 * @param {string} m - モード名
 */
function setMode(m) {
    mode = m;

    // 一旦リセット
    badBtn.classList.remove("bad");
    unknownBtn.classList.remove("unknown");

    // 今のモードを強調表示
    if (m === "bad") {
        badBtn.classList.add("bad");
    } else {
        unknownBtn.classList.add("unknown");
    }
}

// 初期モードを設定
setMode("bad");


// =====================
// 回答送信
// =====================
/**
 * 回答をサーバーに送信
 * 名前が入力されていない場合はプロンプトで入力させる
 */
function submit() {
    let name = document.getElementById("name").value.trim();
    if (!name) {
        while (!name || name === "") {
            name = prompt("名前を入力してください！");
            if (name === null) return;
        }
    }

    const selections = Object.entries(state).map(([key, status]) => {
        const parts = key.split("-");
        return {
            day: `${parts[0]}-${parts[1]}-${parts[2]}`,
            slot: Number(parts[3]),
            status
        };
    });

    fetch(`/${SCHEDULE_ID}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, selections })
    })
        .then(() => {
            location.href = `/${SCHEDULE_ID}/summary`;
        });
}

// =====================
// 初期化
// =====================
// グリッドの初期描画
buildAllWeeks(rebuildSingle);

// ビューポートにスワイプハンドラーをアタッチ
const viewport = document.querySelector(".week-viewport");
if (viewport) {
    attachSwipeHandler(viewport, {
        onSwipeLeft: () => {
            if (hasNextWeek()) {
                nextWeek();
            }
        },
        onSwipeRight: () => {
            if (hasPrevWeek()) {
                prevWeek();
            }
        },
        hasPrevWeek: hasPrevWeek,
        hasNextWeek: hasNextWeek
    }, 10); // 閾値を10pxに設定（schedule.jsの元の実装に合わせる）
}
