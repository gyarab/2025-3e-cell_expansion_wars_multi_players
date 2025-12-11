const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let selectedCell = null;
let lastMouse = { x: 0, y: 0 };
let activeSoldiers = [];
let snapTarget = null;
let autoSendInterval = null;
let activeLinks = [];

// ------------------- CELL CLASS -------------------
class Cell {
    constructor(x, y, radius, color, owner) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.owner = owner; // 1=blue, 2=red, 3=green
        this.soldiers = 20;
        this.maxSoldiers = 30;
        this.underAttack = false;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.soldiers, this.x, this.y + 5);
    }
}

// ------------------- HELPER FUNCTIONS -------------------
function findClosestCell(x, y) {
    for (let c of cells) {
        const dist = Math.hypot(x - c.x, y - c.y);
        if (dist < c.radius) return c;
    }
    return null;
}

function sendSoldiers(from, to) {
    if (from.soldiers <= 0) {
        stopAutoSend();
        return;
    }

    from.soldiers -= 1;

    activeSoldiers.push({
        x: from.x,
        y: from.y,
        target: to,
        owner: from.owner,
        from: from
    });
}

function startAutoSend(from, to) {
    stopAutoSend();
    activeLinks.push({ from, to });
    autoSendInterval = setInterval(() => sendSoldiers(from, to), 1000);
}

function stopAutoSend() {
    if (autoSendInterval) {
        clearInterval(autoSendInterval);
        autoSendInterval = null;
    }
}

// ------------------- CELLS -------------------
let cells = [
    new Cell(200, 350, 45, "blue", 1),   // Player 1
    new Cell(800, 200, 45, "red", 2),    // Player 2
    new Cell(500, 500, 45, "green", 3),  // Player 3
];

// ------------------- MOUSE EVENTS -------------------
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    lastMouse.x = e.clientX - rect.left;
    lastMouse.y = e.clientY - rect.top;

    if (selectedCell) {
        const snapped = findClosestCell(lastMouse.x, lastMouse.y);
        if (snapped && snapped !== selectedCell) snapTarget = snapped;
        else snapTarget = null;
    }
});

canvas.addEventListener("click", () => {
    if (selectedCell && snapTarget) {
        startAutoSend(selectedCell, snapTarget);
        selectedCell = null;
        snapTarget = null;
        return;
    }

    stopAutoSend();

    const c = findClosestCell(lastMouse.x, lastMouse.y);
    if (c && c.owner > 0) { // any owned cell
        selectedCell = c;
    }
});

// ------------------- SOLDIER MOVEMENT -------------------
function updateSoldiers() {
    for (let s of [...activeSoldiers]) { // clone to allow splice
        const dx = s.target.x - s.x;
        const dy = s.target.y - s.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            if (s.owner === s.target.owner) {
                s.target.soldiers++;
                if (s.target.soldiers > s.target.maxSoldiers)
                    s.target.soldiers = s.target.maxSoldiers;
            } else {
                s.target.underAttack = true;
                s.target.soldiers--;
                if (s.target.soldiers <= 0) {
                    // Capture the cell
                    s.target.owner = s.owner;
                    if (s.target.owner === 1) s.target.color = "blue";
                    else if (s.target.owner === 2) s.target.color = "red";
                    else if (s.target.owner === 3) s.target.color = "green";

                    s.target.soldiers = 5;
                    s.target.underAttack = false;

                    // Remove the line and stop auto-sending
                    activeLinks = activeLinks.filter(link => link.to !== s.target);
                    stopAutoSend();
                }
            }
            activeSoldiers.splice(activeSoldiers.indexOf(s), 1);
            continue;
        }

        s.x += dx / dist * 3;
        s.y += dy / dist * 3;

        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = s.owner === 1 ? "lightblue" : s.owner === 2 ? "orange" : "lightgreen";
        ctx.fill();
    }
}

// ------------------- CELL REFILL -------------------
setInterval(() => {
    for (let c of cells) {
        if (!c.underAttack && c.soldiers < c.maxSoldiers) {
            c.soldiers += 1;
        }
    }
}, 500);

// ------------------- DRAW LOOP -------------------
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw active links
    for (let link of activeLinks) {
        ctx.beginPath();
        ctx.moveTo(link.from.x, link.from.y);
        ctx.lineTo(link.to.x, link.to.y);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // draw preview line
    if (selectedCell) {
        ctx.beginPath();
        ctx.moveTo(selectedCell.x, selectedCell.y);
        if (snapTarget) ctx.lineTo(snapTarget.x, snapTarget.y);
        else ctx.lineTo(lastMouse.x, lastMouse.y);
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    for (let c of cells) c.draw();

    updateSoldiers();

    requestAnimationFrame(draw);
}

draw();
