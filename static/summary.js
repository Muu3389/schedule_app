// =====================
// summary state
// =====================
let summaryState = {}; // key -> { bad:[], unknown:[] }

// =====================
// rebuild
// =====================
const { min, max } = calcSlotRange(AVAILABLE_SLOTS);

function rebuildSingle(grid) {
    buildGrid(grid, AVAILABLE_SLOTS, (td, key) => {
        const data = summaryState[key];
        td.classList.add("available");

        if (!data) return;

        const badCount = data.bad.length;
        const unknownCount = data.unknown.length;

        // 表示
        if (badCount || unknownCount) {
            td.textContent = `❌${badCount} ❓${unknownCount}`;
        }

        // 色の優先順位
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
// load data
// =====================
fetch(`/${SCHEDULE_ID}/summary_data`)
    .then(r => r.json())
    .then(data => {
        summaryState = data;
        buildAllWeeks(rebuildSingle);
    });

// =====================
// long press popup
// =====================
let pressTimer = null;
const popup = document.getElementById("detailPopup");

function attachLongPress(td, key) {
    td.onmousedown = () => {
        pressTimer = setTimeout(() => {
            showDetail(td, key);
        }, 400);
    };

    td.onmouseup = hideDetail;
    td.onmouseleave = hideDetail;

    // スマホ対応
    td.ontouchstart = () => {
        pressTimer = setTimeout(() => {
            showDetail(td, key);
        }, 400);
    };
    td.ontouchend = hideDetail;
}

function showDetail(td, key) {
    const data = summaryState[key];
    if (!data) return;

    let html = `<strong>${key}</strong><br><br>`;

    if (data.bad.length) {
        html += "❌ 都合が悪い<br>";
        html += data.bad.map(n => `・${n}`).join("<br>") + "<br><br>";
    }

    if (data.unknown.length) {
        html += "❓ わからない<br>";
        html += data.unknown.map(n => `・${n}`).join("<br>");
    }

    popup.innerHTML = html;
    popup.style.display = "block";

    // マスの下に表示
    const rect = td.getBoundingClientRect();
    popup.style.left = rect.left + "px";
    popup.style.top = rect.top + window.scrollY - popup.offsetHeight + "px";
    popup.style.borderRadius = "8px";
    popup.style.opacity = 0.95;
}

function hideDetail() {
    clearTimeout(pressTimer);
    popup.style.display = "none";
}

fetch(`/${SCHEDULE_ID}/respondents`)
    .then(r => r.json())
    .then(names => {
        const ul = document.getElementById("respondentList");
        ul.innerHTML = "";

        names.forEach(name => {
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.textContent = name;
            a.href = `/${SCHEDULE_ID}/answer?name=${encodeURIComponent(name)}`;
            li.appendChild(a);
            ul.appendChild(li);
        });
    });

const viewport = document.querySelector(".week-viewport");
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;

viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
});

viewport.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    lastX = touch.clientX;
    lastY = touch.clientY;
});

viewport.addEventListener("touchend", () => {
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
    if (slideVector === "right" && hasPrevWeek()) { prevWeek(); }
    if (slideVector === "left" && hasNextWeek()) { nextWeek(); }
});
