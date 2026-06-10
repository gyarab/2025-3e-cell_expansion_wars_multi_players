const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const imgPlayer = new Image();
imgPlayer.src = (window.ASSET_URLS && window.ASSET_URLS.player) ? window.ASSET_URLS.player : "/static/cell_player.png";

const imgEnemy = new Image();
imgEnemy.src = (window.ASSET_URLS && window.ASSET_URLS.enemy) ? window.ASSET_URLS.enemy : "/static/cell_enemy.png";

const imgNeutral = new Image();
imgNeutral.src = (window.ASSET_URLS && window.ASSET_URLS.neutral) ? window.ASSET_URLS.neutral : "/static/cell_neutral.png";

const imgEnemySoldier = new Image();
imgEnemySoldier.src = (window.ASSET_URLS && window.ASSET_URLS.enemySoldier) ? window.ASSET_URLS.enemySoldier : "/static/cell_enemy_soldier.png";

const imgBackgroundTop = new Image();
imgBackgroundTop.src = (window.ASSET_URLS && window.ASSET_URLS.backgroundTop) ? window.ASSET_URLS.backgroundTop : "/static/cellwars_background_top.png";

function nactiObrazek(img) {
    return new Promise(function(resolve) {
        if (img.complete && img.naturalWidth !== 0) { resolve(); return; }
        img.addEventListener('load', resolve);
        img.addEventListener('error', resolve);
    });
}

let selectedCell = null;
let lastMouse = { x: 0, y: 0 };
let activeSoldiers = [];
let snapTarget = null;
let activeLinks = [];
let snapRadius = 80;

let gameOver = false;
let gameResult = null;
let gamePaused = false;
let gameWon = false;
let levelWon = false;

const levels = {
    1: {
        cells: [
            { id: 1, x: 100, y: 300, color: "white", lives: 30 },
            { id: 2, x: 500, y: 400, color: "black", lives: 60 },
            { id: 3, x: 900, y: 100, color: "blue",  lives: 20 },
            { id: 4, x: 400, y: 700, color: "blue",  lives: 20 }
        ]
    },
    2: {
        cells: [
            { id: 1, x: 100, y: 100, color: "white", lives: 60 },
            { id: 2, x: 800, y: 300, color: "black", lives: 30 },
            { id: 3, x: 500, y: 700, color: "black", lives: 30 },
            { id: 4, x: 300, y: 300, color: "blue",  lives: 20 },
            { id: 5, x: 600, y: 200, color: "blue",  lives: 20 },
            { id: 6, x: 800, y: 700, color: "blue",  lives: 20 }
        ]
    },
    3: {
        cells: [
            { id: 1, x: 100, y: 150, color: "white", lives: 60 },
            { id: 2, x: 200, y: 600, color: "white", lives: 60 },
            { id: 3, x: 800, y: 150, color: "black", lives: 30 },
            { id: 4, x: 600, y: 550, color: "black", lives: 30 },
            { id: 5, x: 900, y: 500, color: "black", lives: 30 },
            { id: 6, x: 700, y: 300, color: "black", lives: 30 },
            { id: 7, x: 400, y: 100, color: "blue",  lives: 20 },
            { id: 8, x: 500, y: 400, color: "blue",  lives: 20 },
            { id: 9, x: 300, y: 700, color: "blue",  lives: 20 }
        ]
    }
};

let currentLevel = 1;
let cells = [];
let flakes = [];

function clearAllLinks() {
    for (let link of activeLinks) clearInterval(link.interval);
    activeLinks = [];
}

function loadLevel(levelNumber) {
    clearAllLinks();
    activeSoldiers = [];
    selectedCell = null;
    snapTarget = null;
    cells = [];
    currentLevel = levelNumber;

    if (typeof LEVEL_DATA !== 'undefined' && LEVEL_DATA && typeof LEVEL_ID !== 'undefined') {
        levels[LEVEL_ID] = LEVEL_DATA;
    }

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
    levelWon = false;
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
    if (levelWon) return;
    levelWon = true;
    gameOver = true;
    gameResult = "win";
    gamePaused = true;
    gameWon = true;
    saveWin(currentLevel);
    showWinNotification();
}

function winGame() { onLevelWin(); }

function loseGame() {
    if (gameOver) return;
    gameOver = true;
    gameResult = "lose";
    gamePaused = true;
    showEndOverlay("YOU LOSE", "The enemy took over everything.");
}

function spawnFlake() {
    flakes.push({
        x: Math.random() * canvas.width,
        y: -10,
        speed: 1 + Math.random() * 3,
        size: 3 + Math.random() * 4
    });
}

function saveWin(levelNumber) {
    if (window.saveWin && window.saveWin !== saveWin) {
        window.saveWin(levelNumber);
        return;
    }
    const progress = JSON.parse(localStorage.getItem("progress")) || {};
    progress[`level${levelNumber}`] = true;
    localStorage.setItem("progress", JSON.stringify(progress));
    try {
        if (typeof window.updateLevelButtons === 'function') window.updateLevelButtons();
        if (typeof window.renderAchievements === 'function') window.renderAchievements();
    } catch (e) {}
}

const backToMenuBtn = document.getElementById("backToMenuBtn");
if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', () => {
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
        window.location.href = "/";
    });
}

class Cell {
    constructor(x, y, radius, color, owner) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.owner = owner;
        this.soldiers = 20;
        this.maxSoldiers = 30;
        this.underAttack = false;
    }

    draw() {
        let img = null;
        if (this.owner === 1) img = imgPlayer;
        else if (this.owner === 2) img = imgEnemy;
        else img = imgNeutral;

        ctx.save();
        if (img && img.complete && img.naturalWidth !== 0) {
            ctx.globalCompositeOperation = "screen";
            ctx.drawImage(img, this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color === "white" ? "#2ecc71" : this.color === "black" ? "#9b59b6" : "#3498db";
            ctx.fill();
        }

        if (this === selectedCell) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(0, 255, 136, 0.7)";
            ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = "white";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText(this.soldiers, this.x, this.y + 5);
        ctx.shadowBlur = 0;
    }
}

function getScaledCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function findClosestCell(x, y, expandedRadius = false) {
    let closest = null;
    let closestDist = Infinity;
    for (let c of cells) {
        const dist = Math.hypot(x - c.x, y - c.y);
        const detectionRadius = expandedRadius ? (c.radius + snapRadius) : c.radius;
        if (dist < detectionRadius && dist < closestDist) {
            closest = c;
            closestDist = dist;
        }
    }
    return closest;
}

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
    return Math.hypot(x - px, y - py) <= threshold;
}

function sendSoldiers(from, to) {
    if (from.soldiers <= 0) return;
    from.soldiers -= 1;
    activeSoldiers.push({ x: from.x, y: from.y, target: to, owner: from.owner, from: from });
}

function startAutoSend(from, to) {
    if (activeLinks.some(link => link.from === from && link.to === to)) return;
    const interval = setInterval(() => {
        if (!gamePaused && !gameOver) sendSoldiers(from, to);
    }, 500);
    activeLinks.push({ from, to, interval });
}

// Načtení levelu
try {
    if (typeof LEVEL_DATA !== 'undefined' && LEVEL_DATA && typeof LEVEL_ID !== 'undefined') {
        levels[LEVEL_ID] = LEVEL_DATA;
        loadLevel(LEVEL_ID);
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const levelParam = parseInt(urlParams.get('level'), 10);
        if (!isNaN(levelParam)) loadLevel(levelParam);
        else loadLevel(1);
    }
} catch (e) {
    loadLevel(1);
}

// Události myši
canvas.addEventListener("mousemove", (e) => {
    const coords = getScaledCoords(e);
    lastMouse.x = coords.x;
    lastMouse.y = coords.y;
    if (selectedCell) {
        const snapped = findClosestCell(lastMouse.x, lastMouse.y, true);
        snapTarget = (snapped && snapped !== selectedCell) ? snapped : null;
    }
}, { passive: true });

canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = getScaledCoords(e);

    // Klik na linku = smaž ji
    const clickedLink = activeLinks.find(link => isPointNearLine(x, y, link.from, link.to, 8));
    if (clickedLink) {
        clearInterval(clickedLink.interval);
        activeLinks = activeLinks.filter(l => l !== clickedLink);
        return;
    }

    // Vyber buňku hráče
    const c = findClosestCell(x, y, true);
    if (c && c.owner === 1) {
        selectedCell = (selectedCell === c) ? null : c;
        snapTarget = null;
    } else {
        selectedCell = null;
        snapTarget = null;
    }
}, { passive: true });

canvas.addEventListener('pointerup', (e) => {
    if (!selectedCell) return;
    const { x, y } = getScaledCoords(e);
    const target = findClosestCell(x, y, true);

    if (target && target !== selectedCell) {
        const existing = activeLinks.find(l => l.from === selectedCell && l.to === target);
        if (existing) {
            clearInterval(existing.interval);
            activeLinks = activeLinks.filter(l => !(l.from === selectedCell && l.to === target));
        } else {
            startAutoSend(selectedCell, target);
        }
        selectedCell = null;
        snapTarget = null;
    }
}, { passive: true });

// Pohyb vojáků
function updateSoldiers() {
    for (let i = activeSoldiers.length - 1; i >= 0; i--) {
        const s = activeSoldiers[i];
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
                    s.target.owner = s.owner;
                    s.target.color = s.owner === 1 ? "white" : s.owner === 2 ? "black" : "blue";
                    s.target.soldiers = 5;
                    s.target.underAttack = false;
                    activeLinks = activeLinks.filter(link => {
                        if (link.from === s.target || link.to === s.target) {
                            clearInterval(link.interval);
                            return false;
                        }
                        return true;
                    });
                }
            }
            activeSoldiers.splice(i, 1);
            continue;
        }

        s.x += dx / dist * 4;
        s.y += dy / dist * 4;

        // Vykreslení vojáka
        if (s.owner === 2 && imgEnemySoldier.complete && imgEnemySoldier.naturalWidth !== 0) {
            ctx.drawImage(imgEnemySoldier, s.x - 12, s.y - 12, 24, 24);
        } else {
            ctx.beginPath();
            ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = s.owner === 1 ? "#00ff88" : "orange";
            ctx.fill();
        }
    }
}

// Regenerace vojáků
setInterval(() => {
    if (gamePaused || gameOver) return;
    for (let c of cells) {
        if (!c.underAttack && c.soldiers < c.maxSoldiers) c.soldiers += 1;
        c.underAttack = false;
    }
}, 800);

// AI počítače
setInterval(() => {
    if (gamePaused || gameOver) return;
    const enemies = cells.filter(c => c.owner === 2 && c.soldiers > 5);
    const targets = cells.filter(c => c.owner !== 2);
    if (targets.length === 0 || enemies.length === 0) return;
    for (let enemy of enemies) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        sendSoldiers(enemy, target);
    }
}, 800);

function checkGameEnd() {
    if (gameOver) return;
    const hasWhite = cells.some(c => c.owner === 1);
    const hasBlack = cells.some(c => c.owner === 2);
    if (!hasWhite) loseGame();
    if (!hasBlack && cells.every(c => c.owner === 1)) winGame();
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

const rulesButton = document.getElementById("rulesButton");
const rulesOverlay = document.getElementById("rulesOverlay");
if (rulesButton && rulesOverlay) {
    rulesButton.addEventListener("click", () => {
        rulesOverlay.classList.remove("hidden");
        gamePaused = true;
    });
}

function closeRules() {
    if (rulesOverlay) rulesOverlay.classList.add("hidden");
    gamePaused = false;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Pozadí
    if (imgBackgroundTop.complete && imgBackgroundTop.naturalWidth !== 0) {
        ctx.drawImage(imgBackgroundTop, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#0a0a2a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Linky
    for (let link of activeLinks) {
        ctx.beginPath();
        ctx.moveTo(link.from.x, link.from.y);
        ctx.lineTo(link.to.x, link.to.y);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Preview linka
    if (selectedCell) {
        ctx.beginPath();
        ctx.moveTo(selectedCell.x, selectedCell.y);
        if (snapTarget) ctx.lineTo(snapTarget.x, snapTarget.y);
        else ctx.lineTo(lastMouse.x, lastMouse.y);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    for (let c of cells) c.draw();

    if (!gameOver && !gamePaused) {
        updateSoldiers();
        checkGameEnd();
    }

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

Promise.all([
    nactiObrazek(imgPlayer),
    nactiObrazek(imgEnemy),
    nactiObrazek(imgNeutral),
    nactiObrazek(imgEnemySoldier),
    nactiObrazek(imgBackgroundTop)
]).then(() => draw());