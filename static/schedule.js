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

        // ===== PC（マウス）=====
        td.onmousedown = (e) => {
            e.preventDefault();
            isDrag = true;
            dragAdd = !state[key];
            toggle(td, key);
        };

        td.onmouseover = () => isDrag && toggle(td, key);
        td.onmouseup = () => isDrag = false;

        // ===== スマホ（タッチ）=====
        td.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1) return;

            e.preventDefault(); // マス操作時のみスクロール停止

            isDrag = true;
            dragAdd = !state[key];
            toggle(td, key);
        });

        td.addEventListener("touchmove", (e) => {
            if (!isDrag || e.touches.length !== 1) return;

            e.preventDefault();

            const touch = e.touches[0];
            const el = document.elementFromPoint(
                touch.clientX,
                touch.clientY
            );

            if (!el || el.tagName !== "TD") return;

            const moveKey = el.dataset.key;
            if (!moveKey) return;

            if (dragAdd && !state[moveKey]) toggle(el, moveKey);
            if (!dragAdd && state[moveKey]) toggle(el, moveKey);
        });

        td.addEventListener("touchend", () => {
            isDrag = false;
        });

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
    badBtn.classList.remove("active", "bad");
    unknownBtn.classList.remove("active", "unknown");

    // 今のモードを強調表示
    if (m === "bad") {
        badBtn.classList.add("active", "bad");
    } else {
        unknownBtn.classList.add("active", "unknown");
    }
}


// =====================
function submit() {
    const name = document.getElementById("name").value.trim();
    if (!name) {
        alert("名前を入力してください！");
        return;
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
