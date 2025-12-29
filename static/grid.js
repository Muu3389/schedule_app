/**
 * グリッド表示と週の切り替えを管理するモジュール
 * 全画面で共通して使用される機能を提供
 */

// =====================
// グローバル変数
// =====================
/** 現在表示している週の開始日（日曜日） */
let currentStartDate;

/** 有効日一覧（summary / schedule 用） */
let uniqueDates = [];

// =====================
// 日付・時間のユーティリティ関数
// =====================
/**
 * 指定した日付が含まれる週の日曜日に変換
 * @param {string} dateStr - 日付文字列（YYYY-MM-DD形式）
 * @returns {string} 日曜日の日付文字列（YYYY-MM-DD形式）
 */
function toSunday(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0:日, 1:月, ..., 6:土
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
}

/**
 * 基準日から指定した日数を加算した日付を取得
 * @param {string} base - 基準日（YYYY-MM-DD形式）
 * @param {number} d - 加算する日数
 * @returns {string} 計算後の日付文字列（YYYY-MM-DD形式）
 */
function addDays(base, d) {
    const date = new Date(base);
    date.setDate(date.getDate() + d);
    return date.toISOString().slice(0, 10);
}

/**
 * スロット番号を時間ラベルに変換
 * @param {number} slot - スロット番号
 * @param {number} timeInterval - 時間の区切り幅（分、デフォルト: 30）
 * @returns {string} 時間ラベル（例: "7:00", "7:30"）
 */
function slotLabel(slot, timeInterval = 30) {
    const totalMinutes = slot * timeInterval;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * スロット配列から最小値と最大値を計算
 * @param {string[]} slots - スロットキーの配列（例: ["2024-01-01-0", "2024-01-01-47"]）
 * @returns {{min: number, max: number}} 最小スロット番号と最大スロット番号
 */
function calcSlotRange(slots) {
    const slotNums = slots.map(s => Number(s.split("-")[3]));
    return {
        min: Math.min(...slotNums),
        max: Math.max(...slotNums),
    };
}

// =====================
// 有効日の初期化
// =====================
if (typeof AVAILABLE_SLOTS !== "undefined") {
    const dates = AVAILABLE_SLOTS.map(k =>
        k.split("-").slice(0, 3).join("-")
    );
    uniqueDates = Array.from(new Set(dates)).sort();
}

// =====================
// 現在の週の開始日を設定
// =====================
if (typeof AVAILABLE_SLOTS === "undefined" && today !== undefined) {
    // create画面：今週を表示
    currentStartDate = toSunday(today);
} else {
    // summary / schedule画面：一番古い日付の週を表示
    const firstDate = uniqueDates[0]; // YYYY-MM-DD
    currentStartDate = toSunday(firstDate);
}

/**
 * 指定した週にスロットが含まれているかチェック
 * @param {string[]} slots - スロットキーの配列
 * @param {string} weekStartDate - 週の開始日（日曜日、YYYY-MM-DD形式）
 * @returns {boolean} スロットが含まれている場合true
 */
function hasAnySlotInWeek(slots, weekStartDate) {
    for (const key of slots) {
        const [y, m, d] = key.split("-").slice(0, 3).map(Number);
        const slotDate = new Date(y, m - 1, d);
        const weekStart = new Date(weekStartDate);
        const weekEnd = new Date(weekStartDate);
        weekEnd.setDate(weekEnd.getDate() + 6);

        if (slotDate >= weekStart && slotDate <= weekEnd) {
            return true;
        }
    }
    return false;
}

/**
 * グリッドテーブルを構築
 * @param {HTMLElement} grid - グリッド要素（table要素）
 * @param {string[]|null} slots - 有効なスロットの配列（nullの場合は全て有効）
 * @param {Function|null} cellRenderer - セルをカスタマイズする関数 (td, key) => void
 * @param {number} minSlot - 最小スロット番号（デフォルト: 0）
 * @param {number} maxSlot - 最大スロット番号（デフォルト: 47）
 * @param {number} timeInterval - 時間の区切り幅（分、デフォルト: 30）
 */
function buildGrid(grid, slots, cellRenderer, minSlot = 0, maxSlot = 47, timeInterval = 30) {
    grid.innerHTML = "";

    // ヘッダー行を作成（日付列）
    const header = document.createElement("tr");
    header.innerHTML = "<th>日付<br>時間</th>";

    // 7日分のヘッダーセルを作成
    for (let i = 0; i < 7; i++) {
        const th = document.createElement("th");
        const dateStr = addDays(currentStartDate, i);
        const [y, m, d] = dateStr.split("-");
        th.innerHTML = `${y}<br>${m} / ${d}`;
        header.appendChild(th);
    }
    grid.appendChild(header);

    // 各時間帯の行を作成
    for (let slot = minSlot; slot <= maxSlot; slot++) {
        const tr = document.createElement("tr");

        // 時間ラベルのセル
        const th = document.createElement("th");
        th.textContent = slotLabel(slot, timeInterval);
        tr.appendChild(th);

        // 7日分のセルを作成
        for (let i = 0; i < 7; i++) {
            const day = addDays(currentStartDate, i);
            const key = `${day}-${slot}`;

            const td = document.createElement("td");
            td.dataset.key = key;

            // 無効なスロットの場合はdisabledクラスを追加
            if (Array.isArray(slots) && !slots.includes(key)) {
                td.classList.add("disabled");
            } else if (cellRenderer) {
                // カスタムレンダラーがある場合は実行
                cellRenderer(td, key);
            }

            tr.appendChild(td);
        }

        grid.appendChild(tr);
    }
}

// =====================
// DOM要素の取得
// =====================
const gridPrev = document.getElementById("grid-prev");
const gridNow = document.getElementById("grid-now");
const gridNext = document.getElementById("grid-next");
const slider = document.getElementById("weekSlider");

// =====================
// スライド状態管理
// =====================
/** スライド中に多重入力されるのを防ぐためのフラグ */
let isSliding = false;

// =====================
// 週の構築
// =====================
/**
 * 指定したオフセットの週を構築
 * @param {HTMLElement} grid - グリッド要素
 * @param {number} offset - 週のオフセット（-1: 前週, 0: 今週, 1: 次週）
 * @param {Function} rebuildFn - グリッドを再構築する関数 (grid) => void
 */
function buildWeek(grid, offset, rebuildFn) {
    const base = currentStartDate;
    currentStartDate = addDays(base, offset * 7);

    rebuildFn(grid);

    currentStartDate = base;
}

/**
 * 前週・今週・次週の3つのグリッドを構築
 * @param {Function} rebuildFn - グリッドを再構築する関数 (grid) => void
 */
function buildAllWeeks(rebuildFn) {
    buildWeek(gridPrev, -1, rebuildFn);
    buildWeek(gridNow, 0, rebuildFn);
    buildWeek(gridNext, 1, rebuildFn);
    slider.style.transform = "translateX(-100vw)";
    updateWeekButtons();
}

// =====================
// 週の切り替えアニメーション
// =====================
/**
 * 次の週にスライド
 * @param {Function} rebuildFn - グリッドを再構築する関数 (grid) => void
 */
function slideNext(rebuildFn) {
    if (!hasNextWeek() || isSliding) return;

    isSliding = true;

    // スライドアニメーション開始
    slider.style.transition = "transform 0.15s ease";
    slider.style.transform = "translateX(-200vw)";

    // アニメーション終了後に次の週のデータを読み込む
    slider.addEventListener("transitionend", () => {
        slider.style.transition = "none";
        slider.style.transform = "translateX(-100vw)";

        currentStartDate = addDays(currentStartDate, 7);
        buildAllWeeks(rebuildFn);
        updateWeekButtons();
        isSliding = false;
    }, { once: true });
}

/**
 * 前の週にスライド
 * @param {Function} rebuildFn - グリッドを再構築する関数 (grid) => void
 */
function slidePrev(rebuildFn) {
    if (!hasPrevWeek() || isSliding) return;

    isSliding = true;

    // スライドアニメーション開始
    slider.style.transition = "transform 0.15s ease";
    slider.style.transform = "translateX(0)";

    // アニメーション終了後に前の週のデータを読み込む
    slider.addEventListener("transitionend", () => {
        slider.style.transition = "none";
        slider.style.transform = "translateX(-100vw)";

        currentStartDate = addDays(currentStartDate, -7);
        buildAllWeeks(rebuildFn);
        updateWeekButtons();
        isSliding = false;
    }, { once: true });
}

/**
 * 次の週に移動（グローバル関数）
 */
function nextWeek() {
    slideNext(rebuildSingle);
}

/**
 * 前の週に移動（グローバル関数）
 */
function prevWeek() {
    slidePrev(rebuildSingle);
}


// =====================
// 週のナビゲーション
// =====================
/**
 * 前の週が存在するかチェック
 * @returns {boolean} 前の週が存在する場合true
 */
function hasPrevWeek() {
    if (typeof AVAILABLE_SLOTS === "undefined") return true;
    return uniqueDates.some(d => d < currentStartDate);
}

/**
 * 次の週が存在するかチェック
 * @returns {boolean} 次の週が存在する場合true
 */
function hasNextWeek() {
    if (typeof AVAILABLE_SLOTS === "undefined") return true;
    const end = addDays(currentStartDate, 6);
    return uniqueDates.some(d => d > end);
}

/**
 * 週の切り替えボタンの表示/非表示を更新
 */
function updateWeekButtons() {
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    if (!prevBtn || !nextBtn) return;

    prevBtn.style.visibility = hasPrevWeek() ? "visible" : "hidden";
    nextBtn.style.visibility = hasNextWeek() ? "visible" : "hidden";
}

// =====================
// ヘルプオーバーレイ
// =====================
const helpBtn = document.getElementById("helpBtn");
const helpOverlay = document.getElementById("helpOverlay");
const closeHelp = document.getElementById("closeHelp");

// ヘルプボタンのクリックでオーバーレイを表示
if (helpBtn && helpOverlay) {
    helpBtn.addEventListener("click", () => {
        helpOverlay.style.display = "flex"; // 中央に表示
    });
}

// 閉じるボタンのクリックでオーバーレイを非表示
if (closeHelp && helpOverlay) {
    closeHelp.addEventListener("click", () => {
        helpOverlay.style.display = "none"; // 非表示に
    });
}
