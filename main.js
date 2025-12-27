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
let gameWon = false;
let levelWon = false; // guard against double-win triggers

// ------------------- LEVELS CONFIG -------------------
const levels = {
    1: {
        cells: [
            { id: 1, x: 100, y: 300, color: "white", lives: 30 },
            { id: 2, x: 500, y: 400, color: "black", lives: 60 },
            { id: 3, x: 900, y: 100, color: "blue", lives: 20 },
            { id: 4, x: 400, y: 700, color: "blue", lives: 20 }
        ]
    },

    2: {
        cells: [
            { id: 1, x: 100, y: 100, color: "white", lives: 60 },

            { id: 2, x: 800, y: 300, color: "black", lives: 60 },
            { id: 3, x: 500, y: 700, color: "black", lives: 60 },

            { id: 4, x: 300, y: 300, color: "blue", lives: 20 },
            { id: 5, x: 600, y: 200, color: "blue", lives: 20 },
            { id: 6, x: 800, y: 700, color: "blue", lives: 20 }
        ]
    }
};

let currentLevel = 1;

// clear active link intervals and reset list
function clearAllLinks() {
    for (let link of activeLinks) {
        clearInterval(link.interval);
    }
    activeLinks = [];
}

function loadLevel(levelNumber) {
    clearAllLinks();

    activeSoldiers = [];
    selectedCell = null;
    snapTarget = null;
    cells = [];

    currentLevel = levelNumber;
    const level = levels[levelNumber];
    if (!level) return;

    level.cells.forEach(c => {
        const owner = c.color === "white" ? 1 : c.color === "black" ? 2 : 0;
        const cell = new Cell(c.x, c.y, 45, c.color, owner);
        cell.soldiers = c.lives;
        cell.maxSoldiers = c.lives;
        cells.push(cell);
    });

    gameOver = false;
    gameResult = null;
    gamePaused = false;
    gameWon = false;
    levelWon = false; // reset guard for new run
    flakes = [];
}

function showWinNotification() {
    const ov = document.getElementById("winOverlay");
    if (!ov) return;
    const msg = ov.querySelector('#winMessage');
    if (msg) msg.textContent = `Level ${currentLevel} dokončen`;
    ov.classList.remove('hidden');
    gamePaused = true;
}

function onLevelWin() {
    if (levelWon) return; // protect from multiple triggers
    levelWon = true;

    gameOver = true;
    gameResult = "win";
    gamePaused = true;
    gameWon = true;

    // persist progress
    saveWin(currentLevel);

    // show overlay
    showWinNotification();
}

function winGame() {
    // delegate to the idempotent onLevelWin handler
    onLevelWin();
}

function loseGame() {
    if (gameOver) return;
    gameOver = true;
    gameResult = "lose";
    gamePaused = true;
    showEndOverlay("YOU LOSE", "The enemy took over everything.");
}

// golden flakes
let flakes = [];

function spawnFlake() {
    flakes.push({
        x: Math.random() * canvas.width,
        y: -10,
        speed: 1 + Math.random() * 3,
        size: 3 + Math.random() * 4
    });
}

function saveWin(levelNumber) {
    const progress = JSON.parse(localStorage.getItem("progress")) || {};
    progress[`level${levelNumber}`] = true;
    localStorage.setItem("progress", JSON.stringify(progress));

    // If index page functions are available (same tab/page), update them
    try {
        if (typeof window.updateLevelButtons === 'function') window.updateLevelButtons();
        if (typeof window.renderAchievements === 'function') window.renderAchievements();
    } catch (e) {
        // ignore cross-page or missing functions
    }
} 

function goToFrontPage() {
    location.href = 'index.html';
}

function hideWinPopup() {
    const wp = document.getElementById("winPopup");
    if (wp) wp.classList.add("hidden");
    gamePaused = false;
    gameWon = false;
    flakes = [];
}

// clicking the (legacy) win popup hides it and resumes the game
const winPopupEl = document.getElementById("winPopup");
if (winPopupEl) {
    winPopupEl.addEventListener('click', hideWinPopup);
}

// Back to menu button in the new win overlay
const backToMenuBtn = document.getElementById("backToMenuBtn");
if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', () => {
        // cleanup state
        try { clearAllLinks(); } catch (e) {}
        activeSoldiers = [];
        selectedCell = null;
        snapTarget = null;
        gameOver = false;
        gamePaused = false;
        gameWon = false;
        levelWon = false;
        flakes = [];

        const ov = document.getElementById("winOverlay");
        if (ov) ov.classList.add("hidden");

        // navigate back to front page
        window.location.href = "index.html";
    });
}


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
    // block only duplicate SAME connection
    if (activeLinks.some(link => link.from === from && link.to === to)) return;

    const interval = setInterval(() => {
        if (!gamePaused) sendSoldiers(from, to);
    }, 500);

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
let cells = [];

// By default, load Level 2 (you can call loadLevel(n) to switch)
// Respect ?level= URL param when present
try {
    const urlParams = new URLSearchParams(window.location.search);
    const levelParam = parseInt(urlParams.get('level'), 10);
    if (!isNaN(levelParam)) loadLevel(levelParam);
    else loadLevel(2);
} catch (e) {
    loadLevel(2);
}

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

    const hasWhite = cells.some(c => c.color === "white");
    const hasBlack = cells.some(c => c.color === "black");

    if (!hasWhite) loseGame();
    if (!hasBlack && cells.every(c => c.color === "white")) winGame();
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

    // GOLDEN FLAKES WHEN WON
    if (gameWon) {
        if (Math.random() < 0.3) spawnFlake();

        for (let f of flakes) {
            f.y += f.speed;
            ctx.fillStyle = "gold";
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    requestAnimationFrame(draw);
}

draw();
