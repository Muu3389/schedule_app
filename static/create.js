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

// =====================
// グリッド再構築
// =====================
/**
 * グリッドを再構築し、各セルにイベントハンドラーを設定
 * @param {HTMLElement} grid - グリッド要素
 */
function rebuildSingle(grid) {
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
    }, 0, 47);

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

    fetch("/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            slots: Array.from(state)
        })
    })
        .then(r => r.json())
        .then(d => {
            location.href = `/${d.schedule_id}/summary`;
        });
}

// =====================
// 初期化
// =====================
// 初期描画
buildAllWeeks(rebuildSingle);
