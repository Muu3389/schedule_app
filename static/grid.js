let currentStartDate;
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

if (typeof AVAILABLE_SLOTS === "undefined" && today  !== undefined) {
    // create：今週
    currentStartDate = toSunday(today);
} else {
    // summary / answer：一番古い日付の週
    const firstDate = uniqueDates[0]; // YYYY-MM-DD
    currentStartDate = toSunday(firstDate);
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

    const header = document.createElement("tr");
    header.innerHTML = "<th>日付<br>時間</th>";

    for (let i = 0; i < 7; i++) {
        const th = document.createElement("th");
        const dateStr = addDays(currentStartDate, i);
        const [y, m, d] = dateStr.split("-");
        th.innerHTML = `${y}<br>${m} / ${d}`
        header.appendChild(th);
    }
    grid.appendChild(header);

    for (let slot = minSlot; slot <= maxSlot; slot++) {
        const tr = document.createElement("tr");

        const th = document.createElement("th");
        th.textContent = slotLabel(slot);
        tr.appendChild(th);

        for (let i = 0; i < 7; i++) {
            const day = addDays(currentStartDate, i);
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

const gridPrev = document.getElementById("grid-prev");
const gridNow = document.getElementById("grid-now");
const gridNext = document.getElementById("grid-next");
const slider = document.getElementById("weekSlider");

function buildWeek(grid, offset, rebuildFn) {
    const base = currentStartDate;
    currentStartDate = addDays(base, offset * 7);

    rebuildFn(grid);

    currentStartDate = base;
}

function buildAllWeeks(rebuildFn) {
    buildWeek(gridPrev, -1, rebuildFn);
    buildWeek(gridNow, 0, rebuildFn);
    buildWeek(gridNext, 1, rebuildFn);
    slider.style.transform = "translateX(-100vw)";
    updateWeekButtons();
}

function slideNext(rebuildFn) {
    if (!hasNextWeek()) return;

    slider.style.transition = "transform 0.3s ease";
    slider.style.transform = "translateX(-200vw)";

    slider.addEventListener("transitionend", () => {
        slider.style.transition = "none";
        slider.style.transform = "translateX(-100vw)";

        currentStartDate = addDays(currentStartDate, 7);
        buildAllWeeks(rebuildFn);
        updateWeekButtons();
    }, { once: true });
}

function slidePrev(rebuildFn) {
    if (!hasPrevWeek()) return;

    slider.style.transition = "transform 0.3s ease";
    slider.style.transform = "translateX(0)";

    slider.addEventListener("transitionend", () => {
        slider.style.transition = "none";
        slider.style.transform = "translateX(-100vw)";

        currentStartDate = addDays(currentStartDate, -7);
        buildAllWeeks(rebuildFn);
        updateWeekButtons();
    }, { once: true });
}

function nextWeek() {
    slideNext(rebuildSingle);
}

function prevWeek() {
    slidePrev(rebuildSingle);
}


function hasPrevWeek() {
    if (typeof AVAILABLE_SLOTS === "undefined") return true;
    return uniqueDates.some(d => d < currentStartDate);
}

function hasNextWeek() {
    if (typeof AVAILABLE_SLOTS === "undefined") return true;
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

const helpBtn = document.getElementById("helpBtn");
const helpOverlay = document.getElementById("helpOverlay");
const closeHelp = document.getElementById("closeHelp");

helpBtn.addEventListener("click", () => {
    helpOverlay.style.display = "flex"; // 中央に表示
});

closeHelp.addEventListener("click", () => {
    helpOverlay.style.display = "none"; // 非表示に
});
