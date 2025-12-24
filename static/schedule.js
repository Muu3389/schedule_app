const grid = document.getElementById("grid");
const badBtn = document.getElementById("badBtn");
const unknownBtn = document.getElementById("unknownBtn");

let mode = "bad";
let isDrag = false;
let dragAdd = true;

// =====================
// 選択状態
// =====================
const state = {}; // key -> bad / unknown
const { min, max } = calcSlotRange(AVAILABLE_SLOTS);

// 既存回答の復元
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
// rebuild
// =====================
function rebuild() {
    buildGrid(grid, AVAILABLE_SLOTS, (td, key) => {

        // 有効マスは青
        td.classList.add("available");

        if (state[key]) {
            td.classList.remove("available");
            td.classList.add(state[key]);
        }

        // タッチ用変数
        let isTouch = false;
        let touchStartTime = 0; // タッチ開始時間
        let startKey = null;    // タッチ開始key
        let startTd = null;  // タッチ開始td
        let isScroll = false;  // 実質動いたか
        let dragStarted = false;    // ドラッグ開始したか
        let el = null;  // 現在の要素
        let moveKey = null;   // 現在のkey
        let elapsed = 0;    // 経過時間

        // ===== スマホ（タッチ）=====
        td.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1) return;

            isTouch = true;
            touchStartTime = Date.now();
            startKey = key;
            startTd = td;
            isScroll = false;
            dragStarted = false;

            isDrag = false
        });

        td.addEventListener("touchmove", (e) => {
            if (e.touches.length !== 1) return;

            elapsed = Date.now() - touchStartTime;
            const touch = e.touches[0];
            el = document.elementFromPoint(
                touch.clientX,
                touch.clientY
            );
            if (!el || el.tagName !== "TD") return; // 無効マスを無視

            if (el.classList.contains("disabled")) return;   // 無効マスは無視


            moveKey = el.dataset.key;
            if (!moveKey) return;   // 無効マスを無視

            if (moveKey !== startKey && !isScroll && elapsed < 250) isScroll = true; // スクロール判定

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
                dragAdd = !Object.hasOwn(state, startKey);
                toggle(startTd, startKey);
            }

            // マス切り替え
            if (dragAdd && !Object.hasOwn(state, moveKey)) toggle(el, moveKey);
            if (!dragAdd && Object.hasOwn(state, moveKey)) toggle(el, moveKey);
        }, { passive: false });

        td.addEventListener("touchend", (e) => {
            const elapsed = Date.now() - touchStartTime;

            // 短タップ（0.3秒未満 ＆ 移動なし）
            if (elapsed < 300 && !isScroll) {
                dragAdd = !Object.hasOwn(state, startKey);
                toggle(startTd, startKey);
            }

            isDrag = false;
            e.preventDefault();
            e.stopPropagation();
        });

        // ===== PC（マウス）=====
        td.onmousedown = (e) => {
            e.preventDefault();
            isDrag = true;
            dragAdd = !state[key];
            toggle(td, key);
        };

        td.onmouseover = () => isDrag && toggle(td, key);
        td.onmouseup = () => isDrag = false;

    }, min, max);

    updateWeekButtons();
}

setMode("bad");

// =====================
// toggle
// =====================
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
document.addEventListener("mouseup", () => {
    isDrag = false;
});

// =====================
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


// =====================
function submit() {
    let name = document.getElementById("name").value.trim();
    if (!name) {
        // alert("名前を入力してください！");
        while (!name || name === "") {
            name = prompt("名前を入力してください！");
            if (name === null) return;
        }
        // return;
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

rebuild();
