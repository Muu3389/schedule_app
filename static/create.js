const grid = document.getElementById("grid");

const state = new Set();    // 選択中のkey集合

let isDrag = false;   // PC & スマホ共通
let dragAdd = true;  // 追加 or 解除

function rebuild() {
    buildGrid(grid, null, (td, key) => {
        if (state.has(key)) td.classList.add("selected");

        // ===== PC（マウス）=====
        td.onmousedown = (e) => {
            e.preventDefault();
            isDrag = true;
            dragAdd = !state.has(key);
            toggle(td, key);
        };

        td.onmouseover = () => isDrag && toggle(td, key);
        td.onmouseup = () => isDrag = false;

        // ===== スマホ（タッチ）=====
        td.addEventListener("touchstart", (e) => {
            if (e.touches.length !== 1) return;

            e.preventDefault(); // ← マスはスクロールさせない

            isDrag = true;
            dragAdd = !state.has(key);
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

            if (dragAdd && !state.has(moveKey)) toggle(el, moveKey);
            if (!dragAdd && state.has(moveKey)) toggle(el, moveKey);
        });

        td.addEventListener("touchend", () => {
            isDrag = false;
        });

    }, 0, 47); // ★ 0:00〜23:30 全表示

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
    if (dragAdd) {
        state.add(key);
        td.classList.add("selected");
    } else {
        state.delete(key);
        td.classList.remove("selected");
    }
}

// 初期描画
rebuild();

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
            start_date: START_DATE,
            slots: Array.from(state)
        })
    })
        .then(r => r.json())
        .then(d => {
            location.href = `/${d.schedule_id}/summary`;
        });
}
