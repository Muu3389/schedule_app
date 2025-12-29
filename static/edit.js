/**
 * 選択可能マス編集画面のメインロジック
 * available_slotsの編集を管理
 */

// =====================
// 状態管理
// =====================
/** 選択中の時間帯のキー集合（既存のavailable_slotsから初期化） */
const state = new Set(AVAILABLE_SLOTS);

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
    // スロット範囲の計算
    let min = 0;
    let max = Math.floor(1440 / TIME_INTERVAL) - 1;

    if (state.size > 0) {
        const range = calcSlotRange(Array.from(state));
        min = Math.min(min, range.min);
        max = Math.max(max, range.max);
    }

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
    }, min, max, TIME_INTERVAL);

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
// 変更保存
// =====================
/**
 * 変更をサーバーに保存
 */
function save() {
    if (state.size === 0) {
        if (!confirm("選択可能マスが0個になります。本当に保存しますか？")) {
            return;
        }
    }

    fetch(`/${SCHEDULE_ID}/update_slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            slots: Array.from(state),
            password: CREATOR_PASSWORD
        })
    })
        .then(r => {
            if (r.status === 401) {
                alert("パスワードが正しくありません");
                return;
            }
            return r.json();
        })
        .then(d => {
            if (d && d.success) {
                alert("変更を保存しました");
                location.href = `/${SCHEDULE_ID}/summary`;
            }
        })
        .catch(() => {
            alert("エラーが発生しました");
        });
}

// =====================
// 初期化
// =====================
// 初期描画
buildAllWeeks(rebuildSingle);
