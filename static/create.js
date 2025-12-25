const state = new Set();    // 選択中のkey集合

let isDrag = false;   // PC & スマホ共通
let dragAdd = true;  // 追加 or 解除

function rebuildSingle(grid) {
    buildGrid(grid, null, (td, key) => {
        if (state.has(key)) td.classList.add("selected");

        // =====================
        // タッチ用変数
        // =====================
        let touchStartTime = 0; // タッチ開始時間
        let startKey = null;    // タッチ開始key
        let startTd = null;  // タッチ開始td
        let isScroll = false;  // 実質動いたか
        let dragStarted = false;    // ドラッグ開始したか
        let el = null;  // 現在の要素
        let moveKey = null;   // 現在のkey
        let elapsed = 0;    // 経過時間
        let startX = 0;   // 開始X座標
        let startY = 0;   // 開始Y座標
        let lastX = 0;    // 最後のX座標
        let lastY = 0;    // 最後のY座標

        // ===== スマホ（タッチ）=====
        td.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;

            touchStartTime = Date.now();
            startKey = key;
            startTd = td;
            isScroll = false;
            dragStarted = false;

            isDrag = false;
        });

        td.addEventListener("touchmove", (e) => {
            if (e.touches.length !== 1) return;

            elapsed = Date.now() - touchStartTime;
            const touch = e.touches[0];
            el = document.elementFromPoint(
                touch.clientX,
                touch.clientY
            );
            lastX = touch.clientX;
            lastY = touch.clientY;

            if (!el || el.tagName !== "TD") return; // 無効マスを無視

            moveKey = el.dataset.key;
            if (!moveKey) return;   // 無効マスを無視

            if(moveKey !== startKey && !isScroll && elapsed < 250) isScroll = true; // スクロール判定

            // 0.24秒未満なら何もしない
            if (elapsed < 250) return;

            // スクロールだったら何もしない
            if (isScroll) return;

            // スクロール防止
            e.preventDefault();

            // ドラッグ開始
            if (!dragStarted) {
                dragStarted = true;
                isDrag = true;
                dragAdd = !state.has(startKey);
                toggle(startTd, startKey);
            }

            // マス切り替え
            if (dragAdd && !state.has(moveKey)) toggle(el, moveKey);
            if (!dragAdd && state.has(moveKey)) toggle(el, moveKey);
        }, { passive: false });

        td.addEventListener("touchend", (e) => {
            const elapsed = Date.now() - touchStartTime;

            const dX = lastX - startX;
            const dY = lastY - startY;
            let slideVector = null;
            if (Math.abs(dX) > 50 && Math.abs(dY) < Math.abs(dX)) {
                if (dX > 0) {
                    slideVector = "right";
                } else {
                    slideVector = "left";
                }
            }
            if (isScroll && slideVector === "right" && hasPrevWeek()) {prevWeek();}
            if (isScroll && slideVector === "left" && hasNextWeek()) {nextWeek();}

            // 短タップ（0.25秒未満 ＆ 移動なし）
            if (elapsed < 250 && !isScroll) {
                dragAdd = !state.has(startKey);
                toggle(startTd, startKey);
            }

            isDrag = false;
            if (e.cancelable) {
                e.preventDefault();
            }
            e.stopPropagation();
        });

        // ===== PC（マウス）=====
        td.onmousedown = (e) => {
            e.preventDefault();
            isDrag = true;
            dragAdd = !state.has(key);
            toggle(td, key);
        };

        td.onmouseover = () => isDrag && toggle(td, key);
        td.onmouseup = () => isDrag = false;

    }, 0, 47);

    updateWeekButtons();
}



// =====================
// global mouse up
// =====================
document.addEventListener("mouseup", () => {
    isDrag = false;
});

// 選択中マスの切り替え
function toggle(td, key) {
    if(!td) return;
    if (dragAdd) {
        state.add(key);
        td.classList.add("selected");
    } else {
        state.delete(key);
        td.classList.remove("selected");
    }
}

// 初期描画
buildAllWeeks(rebuildSingle);

// =====================
// create submit
// =====================
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
