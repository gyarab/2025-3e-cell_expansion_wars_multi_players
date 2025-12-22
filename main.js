const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let selectedCell = null;
let lastMouse = { x: 0, y: 0 };
let activeSoldiers = [];
let snapTarget = null;
let activeLinks = []; // each link: { from, to, interval }
let snapRadius = 80; // larger snap area for touchpad responsiveness

// Game state
let gameOver = false;
let gameResult = null; // "win" | "lose"
let gamePaused = false; // when true, AI and refill pause, drawing continues


class Cell {
    constructor(x, y, radius, color, owner) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.owner = owner; // owners: 0=neutral, 1=player, 2=computer
        this.soldiers = 20;
        this.maxSoldiers = 30;
        this.underAttack = false;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Draw soldier count with readable contrast on white cells
        ctx.fillStyle = this.color === "white" ? "black" : "white";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.soldiers, this.x, this.y + 5);
    }
}

// ------------------- HELPER FUNCTIONS -------------------
function findClosestCell(x, y, expandedRadius = false) {
    let closest = null;
    let closestDist = Infinity;
    const radiusFactor = expandedRadius ? snapRadius : null;

    for (let c of cells) {
        const dist = Math.hypot(x - c.x, y - c.y);
        const detectionRadius = expandedRadius ? radiusFactor : c.radius;
        if (dist < detectionRadius && dist < closestDist) {
            closest = c;
            closestDist = dist;
        }
    }
    return closest;
}

// Return true if point (x,y) is within `threshold` pixels of the segment from `a` to `b`
function isPointNearLine(x, y, a, b, threshold = 6) {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = x - a.x;
    const wy = y - a.y;
    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    let t = 0;
    if (c2 !== 0) t = c1 / c2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * vx;
    const py = a.y + t * vy;
    const dist = Math.hypot(x - px, y - py);
    return dist <= threshold;
}

function sendSoldiers(from, to) {
    // Allow sending even with low soldiers - as long as > 0
    if (from.soldiers <= 0) {
        return; // silently skip this frame if no soldiers
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
    if (activeLinks.some(link => link.from === from && link.to === to)) return;
    const interval = setInterval(() => {
        if (!gameOver && !gamePaused) sendSoldiers(from, to);
    }, 500); // faster: 500ms instead of 1000ms
    activeLinks.push({ from, to, interval });
} 

function stopAutoSendToTarget(target) {
    activeLinks = activeLinks.filter(link => {
        if (link.to === target) {
            clearInterval(link.interval);
            return false;
        }
        return true;
    });
}

// ------------------- CELLS -------------------
let cells = [
    // Player cell (WHITE)
    new Cell(300, 400, 45, "white", 1),

    // Enemy cell (BLACK)
    new Cell(700, 300, 45, "black", 2),

    // Neutral cells (BLUE)
    new Cell(500, 550, 45, "blue", 0),
    new Cell(900, 500, 45, "blue", 0),
];

// Set starting soldiers explicitly
cells[0].soldiers = 30; // player
cells[1].soldiers = 60; // enemy
cells[2].soldiers = 20;
cells[3].soldiers = 20;

// ------------------- MOUSE EVENTS -------------------
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    lastMouse.x = e.clientX - rect.left;
    lastMouse.y = e.clientY - rect.top;

    if (selectedCell) {
        const snapped = findClosestCell(lastMouse.x, lastMouse.y, true);
        if (snapped && snapped !== selectedCell) snapTarget = snapped;
        else snapTarget = null;
    }
}, { passive: true });

// pointerdown for better touch/touchpad support (uses expanded radius)
canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // If user clicked near an active link, toggle that link off
    const clickedLink = activeLinks.find(link => isPointNearLine(x, y, link.from, link.to, 8));
    if (clickedLink) {
        clearInterval(clickedLink.interval);
        activeLinks = activeLinks.filter(l => l !== clickedLink);
        return;
    }

    if (selectedCell && snapTarget) {
        // toggle: if link exists, stop it; otherwise start it
        const existing = activeLinks.find(l => l.from === selectedCell && l.to === snapTarget);
        if (existing) {
            clearInterval(existing.interval);
            activeLinks = activeLinks.filter(l => !(l.from === selectedCell && l.to === snapTarget));
        } else {
            startAutoSend(selectedCell, snapTarget);
        }
        snapTarget = null;
        return;
    }

    const c = findClosestCell(x, y, true);

    if (!c) {
        // clicked empty space → cancel selection and line
        selectedCell = null;
        snapTarget = null;
        return;
    }

    // allow selecting ONLY player cell
    if (c.owner === 1) {
        selectedCell = selectedCell === c ? null : c;
    }
}, { passive: true });

canvas.addEventListener("click", () => {
    // If user clicked near an active link, toggle it off
    const clickedLink = activeLinks.find(link => isPointNearLine(lastMouse.x, lastMouse.y, link.from, link.to, 8));
    if (clickedLink) {
        clearInterval(clickedLink.interval);
        activeLinks = activeLinks.filter(l => l !== clickedLink);
        return;
    }

    if (selectedCell && snapTarget) {
        // toggle on click: stop existing link if present, otherwise start
        const existing = activeLinks.find(l => l.from === selectedCell && l.to === snapTarget);
        if (existing) {
            clearInterval(existing.interval);
            activeLinks = activeLinks.filter(l => !(l.from === selectedCell && l.to === snapTarget));
        } else {
            startAutoSend(selectedCell, snapTarget);
        }
        snapTarget = null;
        return;
    }

    // Use expanded detection radius for clicks so the whole cell area is clickable
    const c = findClosestCell(lastMouse.x, lastMouse.y, true);

    if (!c) {
        // clicked empty space → cancel selection and line
        selectedCell = null;
        snapTarget = null;
        return;
    }

    // allow selecting ONLY player cell
    if (c.owner === 1) {
        selectedCell = selectedCell === c ? null : c;
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
                    if (s.target.owner === 1) s.target.color = "white";
                    else if (s.target.owner === 2) s.target.color = "black";
                    else s.target.color = "blue";

                    s.target.soldiers = 5;
                    s.target.underAttack = false;

                    // ----------------------------
                    // DETACH LINES CONNECTED TO THIS CELL
                    // remove links where this cell is the source or the target
                    activeLinks = activeLinks.filter(link => {
                        if (link.from === s.target || link.to === s.target) {
                            clearInterval(link.interval);
                            return false;
                        }
                        return true;
                    });
                    // ----------------------------
                }
            }
            activeSoldiers.splice(activeSoldiers.indexOf(s), 1);
            continue;
        }

        s.x += dx / dist * 4;
        s.y += dy / dist * 4;

        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = s.owner === 1 ? "white" : s.owner === 2 ? "orange" : "lightblue";
        ctx.fill();
    }
}

// ------------------- CELL REFILL (WITH RECOVERY FROM ZERO) -------------------
setInterval(() => {
    if (gamePaused || gameOver) return;

    for (let c of cells) {
        if (!c.underAttack && c.soldiers < c.maxSoldiers) {
            c.soldiers += 1; // slow regeneration
        }

        // reset underAttack flag every tick
        c.underAttack = false;
    }
}, 800); // slower = more strategic

// ------------------- COMPUTER AI (MULTI-CELL) -------------------
setInterval(() => {
    if (gamePaused || gameOver) return;

    // all black cells with enough soldiers will attack
    const enemies = cells.filter(c => c.owner === 2 && c.soldiers > 5);
    const targets = cells.filter(c => c.owner !== 2);
    if (targets.length === 0 || enemies.length === 0) return;

    for (let enemy of enemies) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        sendSoldiers(enemy, target);
    }
}, 800);

// ------------------- GAME END CHECKS -------------------
function checkGameEnd() {
    if (gameOver) return;

    const allWhite = cells.every(c => c.owner === 1);
    const allBlack = cells.every(c => c.owner === 2);

    if (allWhite) {
        gameOver = true;
        gameResult = "win";
        showEndOverlay("YOU WIN", "All cells are yours!");
    }

    if (allBlack) {
        gameOver = true;
        gameResult = "lose";
        showEndOverlay("YOU LOSE", "The enemy took over everything.");
    }
}

function showEndOverlay(title, text) {
    const overlay = document.getElementById("endOverlay");
    const titleEl = document.getElementById("endTitle");
    const textEl = document.getElementById("endText");

    if (!overlay || !titleEl || !textEl) return;

    titleEl.textContent = title;
    textEl.textContent = text;

    overlay.classList.remove("hidden");
}

// Rules overlay controls
const rulesButton = document.getElementById("rulesButton");
const rulesOverlay = document.getElementById("rulesOverlay");

if (rulesButton && rulesOverlay) {
    rulesButton.addEventListener("click", () => {
        rulesOverlay.classList.remove("hidden");
        gamePaused = true; // freeze game while rules are open
    });
} 

function closeRules() {
    if (rulesOverlay) rulesOverlay.classList.add("hidden");
    gamePaused = false; // resume game on close
} 

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

    if (!gameOver && !gamePaused) {
        updateSoldiers();
        checkGameEnd();
    }

    requestAnimationFrame(draw);
}

draw();
