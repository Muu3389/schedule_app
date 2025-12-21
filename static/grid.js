let currentStartDate = toSunday(START_DATE);

function toSunday(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0:日, 1:月, ..., 6:土
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
}
// ===== 有効日一覧（summary / schedule 用）=====
let uniqueDates = [];

if (typeof AVAILABLE_SLOTS !== "undefined") {
    const dates = AVAILABLE_SLOTS.map(k =>
        k.split("-").slice(0, 3).join("-")
    );
    uniqueDates = Array.from(new Set(dates)).sort();
}

function addDays(base, d) {
    const date = new Date(base);
    date.setDate(date.getDate() + d);
    return date.toISOString().slice(0, 10);
}

function slotLabel(slot) {
    const h = Math.floor(slot / 2);
    const m = slot % 2 === 0 ? "00" : "30";
    return `${h}:${m}`;
}

function calcSlotRange(slots) {
    const slotNums = slots.map(s => Number(s.split("-")[3]));
    return {
        min: Math.min(...slotNums),
        max: Math.max(...slotNums),
    };
}


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

function buildGrid(grid, slots, cellRenderer, minSlot = 0, maxSlot = 47) {
    grid.innerHTML = "";

    // ===== ヘッダ行（時間）=====
    const header = document.createElement("tr");
    header.innerHTML = "<th></th>";

    for (let slot = minSlot; slot <= maxSlot; slot++) {
        const th = document.createElement("th");
        th.textContent = slotLabel(slot);
        header.appendChild(th);
    }
    grid.appendChild(header);

    // ===== 各日付ごとに1行 =====
    for (let i = 0; i < 7; i++) {
        const day = addDays(currentStartDate, i);

        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.textContent = day;
        tr.appendChild(th);

        for (let slot = minSlot; slot <= maxSlot; slot++) {
            const key = `${day}-${slot}`;
            const td = document.createElement("td");
            td.dataset.key = key;

            if (Array.isArray(slots) && !slots.includes(key)) {
                td.classList.add("disabled");
            } else if (cellRenderer) {
                cellRenderer(td, key);
            }

            tr.appendChild(td);
        }

        grid.appendChild(tr);
    }
}


function nextWeek() {
    currentStartDate = addDays(currentStartDate, 7);
    rebuild();
    updateWeekButtons();
}

function prevWeek() {
    currentStartDate = addDays(currentStartDate, -7);
    rebuild();
    updateWeekButtons();
}


function hasPrevWeek() {
    return uniqueDates.some(d => d < currentStartDate);
}

function hasNextWeek() {
    const end = addDays(currentStartDate, 6);
    return uniqueDates.some(d => d > end);
}

function updateWeekButtons() {
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    if (!prevBtn || !nextBtn) return;

    prevBtn.style.visibility = hasPrevWeek() ? "visible" : "hidden";
    nextBtn.style.visibility = hasNextWeek() ? "visible" : "hidden";
}
