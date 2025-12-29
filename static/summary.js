/**
 * スケジュール集計画面のメインロジック
 * 回答の集計と表示を管理
 */

// =====================
// 状態管理
// =====================
/** 集計状態（key -> { bad:[], unknown:[] }） */
let summaryState = {};

// =====================
// グリッド再構築
// =====================
/** スロット範囲の計算 */
const { min, max } = calcSlotRange(AVAILABLE_SLOTS);

/**
 * グリッドを再構築し、各セルにイベントハンドラーを設定
 * @param {HTMLElement} grid - グリッド要素
 */
function rebuildSingle(grid) {
    buildGrid(grid, AVAILABLE_SLOTS, (td, key) => {
        const data = summaryState[key];
        td.classList.add("available");

        if (!data) {
            attachLongPress(td, key);
            return;
        }

        const badCount = data.bad.length;
        const unknownCount = data.unknown.length;

        // 回答数の表示
        if (badCount || unknownCount) {
            td.textContent = `❌${badCount} ❓${unknownCount}`;
        }

        // 色の優先順位（bad > unknown > available）
        if (badCount > 0) {
            td.classList.remove("available");
            td.classList.add("has-bad");
        } else if (unknownCount > 0) {
            td.classList.remove("available");
            td.classList.add("has-unknown");
        }

        attachLongPress(td, key);
    }, min, max);

    updateWeekButtons();
}


// =====================
// データ読み込み
// =====================
/**
 * サーバーから集計データを取得してグリッドを構築
 */
fetch(`/${SCHEDULE_ID}/summary_data`)
    .then(r => r.json())
    .then(data => {
        summaryState = data;
        buildAllWeeks(rebuildSingle);
    });

// =====================
// 長押しポップアップ
// =====================
/** 長押しタイマー */
let pressTimer = null;

/** 詳細ポップアップ要素 */
const detailPopup = document.getElementById("detailPopup");

/**
 * セルに長押しイベントハンドラーをアタッチ
 * @param {HTMLElement} td - セル要素
 * @param {string} key - セルのキー
 */
function attachLongPress(td, key) {
    // PC用（マウス）
    td.onmousedown = () => {
        pressTimer = setTimeout(() => {
            showDetail(td, key);
        }, 400);
    };

    td.onmouseup = hideDetail;
    td.onmouseleave = hideDetail;

    // スマホ用（タッチ）
    td.ontouchstart = () => {
        pressTimer = setTimeout(() => {
            showDetail(td, key);
        }, 400);
    };
    td.ontouchend = hideDetail;
}

/**
 * 詳細ポップアップを表示
 * @param {HTMLElement} td - セル要素
 * @param {string} key - セルのキー
 */
function showDetail(td, key) {
    const data = summaryState[key];
    if (!data) return;

    let html = `<strong>${key}</strong><br><br>`;

    // 都合が悪い人のリスト
    if (data.bad.length) {
        html += "❌ 都合が悪い<br>";
        html += data.bad.map(n => `・${n}`).join("<br>") + "<br><br>";
    }

    // わからない人のリスト
    if (data.unknown.length) {
        html += "❓ わからない<br>";
        html += data.unknown.map(n => `・${n}`).join("<br>");
    }

    detailPopup.innerHTML = html;
    detailPopup.style.display = "block";

    // マスの下に表示
    const rect = td.getBoundingClientRect();
    detailPopup.style.left = rect.left + "px";
    detailPopup.style.top = rect.top + window.scrollY - detailPopup.offsetHeight + "px";
    detailPopup.style.borderRadius = "8px";
    detailPopup.style.opacity = 0.95;
}

/**
 * 詳細ポップアップを非表示にする
 */
function hideDetail() {
    clearTimeout(pressTimer);
    detailPopup.style.display = "none";
}

// =====================
// 回答者一覧ポップアップ
// =====================
const showBtn = document.getElementById("showRespondentsBtn");
const respondentPopup = document.getElementById("respondentPopup");

/**
 * 回答者一覧ボタンのクリック処理
 */
showBtn.onclick = (e) => {
    e.stopPropagation();

    // 既に表示されている場合は閉じる
    if (respondentPopup.style.display === "block") {
        respondentPopup.style.display = "none";
        return;
    }

    // ボタンの位置に合わせてポップアップを表示
    const rect = showBtn.getBoundingClientRect();
    respondentPopup.style.display = "block";
    respondentPopup.style.position = "absolute";
    respondentPopup.style.left = rect.left + "px";
    respondentPopup.style.top = rect.bottom + window.scrollY - 40 + "px";
};

// ポップアップ内クリックで閉じないようにする
respondentPopup.addEventListener("click", (e) => {
    e.stopPropagation();
});

// ポップアップ外クリックで閉じる
document.addEventListener("click", () => {
    respondentPopup.style.display = "none";
});

/**
 * 回答者リストをレンダリング
 * @param {HTMLElement} ul - リスト要素
 * @param {string[]} names - 回答者名の配列
 */
function renderRespondents(ul, names) {
    ul.innerHTML = "";
    names.forEach(name => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.textContent = name;
        a.href = `/${SCHEDULE_ID}/answer?name=${encodeURIComponent(name)}`;
        li.appendChild(a);
        ul.appendChild(li);
    });
}

// 回答者リストを取得して表示
fetch(`/${SCHEDULE_ID}/respondents`)
    .then(r => r.json())
    .then(names => {
        renderRespondents(
            document.getElementById("respondentPopupList"),
            names
        );
    });

// =====================
// スワイプ処理の初期化
// =====================
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
    }, 50); // 閾値を50pxに設定（summary.jsの元の実装に合わせる）
}
