

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");



const imgPlayer = new Image();
imgPlayer.src = (window.ASSET_URLS && window.ASSET_URLS.player) ? window.ASSET_URLS.player : "cell_player.png";

const imgEnemy = new Image();
imgEnemy.src = (window.ASSET_URLS && window.ASSET_URLS.enemy) ? window.ASSET_URLS.enemy : "cell_enemy.png";

const imgNeutral = new Image();
imgNeutral.src = (window.ASSET_URLS && window.ASSET_URLS.neutral) ? window.ASSET_URLS.neutral : "cell_neutral.png";

// NOVÝ OBRÁZEK PRO NEPŘÁTELSKÉ VOJÁKY
const imgEnemySoldier = new Image();
imgEnemySoldier.src = (window.ASSET_URLS && window.ASSET_URLS.enemySoldier) ? window.ASSET_URLS.enemySoldier : "cell_enemy_soldier.png";

const imgBackgroundTop = new Image();
imgBackgroundTop.src = (window.ASSET_URLS && window.ASSET_URLS.backgroundTop) ? window.ASSET_URLS.backgroundTop : "cellwars_background_top.png";

const imgBackground = new Image();
imgBackground.src = "imgonline-com-ua-TextureSeamless-6K5QQl8U0HrOdQ__1_.jpg";

/**
 * Pomocná funkce pro bezpečné načítání obrázků.
 * Zajišťuje, že se hra nespustí dříve, než jsou všechny podklady připraveny.
 */
function nactiObrazek(img) {
    return new Promise(function(resolve) {
        if (img.complete) {
            resolve();
            return;
        }
        img.addEventListener('load', function() {
            resolve();
        });
        img.addEventListener('error', function() {
            console.warn("Obrázek se nepodařilo načíst (použije se záložní grafika): " + img.src);
            resolve(); 
        });
    });
}



let selectedCell = null;        // Aktuálně vybraná buňka hráče pro vysílání vojsk
let lastMouse = { x: 0, y: 0 }; // Poslední známá pozice myši
let soldiers = [];              // Pole objektů reprezentujících vojáky v pohybu
let snapTarget = null;          // Cíl, ke kterému se "přilepí" preview linka
let activeLinks = [];           // Seznam aktivních proudů (auto-vysílání)
let snapRadius = 80;            // Vzdálenost pro detekci blízkosti buňky

// Stavové proměnné hry
let gameOver = false;
let gameResult = null;
let gamePaused = false;
let gameWon = false;
let levelWon = false;


/**
 * Definice rozložení buněk pro jednotlivé úrovně.
 * Lives určují počet počátečních vojáků a zároveň maximální kapacitu buňky.
 */
const levels = {
    1: {
        cells: [
            { id: 1, x: 100, y: 300, color: "green", lives: 30 },
            { id: 2, x: 500, y: 400, color: "purple", lives: 60 },
            { id: 3, x: 900, y: 100, color: "blue", lives: 20 },
            { id: 4, x: 400, y: 700, color: "blue", lives: 20 }
        ]
    },
    2: {
        cells: [
            { id: 1, x: 100, y: 100, color: "green", lives: 60 },
            { id: 2, x: 800, y: 300, color: "purple", lives: 60 },
            { id: 3, x: 500, y: 700, color: "purple", lives: 60 },
            { id: 4, x: 300, y: 300, color: "blue", lives: 20 },
            { id: 5, x: 600, y: 200, color: "blue", lives: 20 },
            { id: 6, x: 800, y: 700, color: "blue", lives: 20 }
        ]
    },
    3: { 
        cells: [
            { id: 1, x: 100, y: 400, color: "green", lives: 50 },
            { id: 2, x: 900, y: 400, color: "purple", lives: 50 },
            { id: 3, x: 500, y: 150, color: "purple", lives: 80 },
            { id: 4, x: 500, y: 650, color: "blue", lives: 40 },
            { id: 5, x: 300, y: 200, color: "blue", lives: 25 },
            { id: 6, x: 700, y: 200, color: "blue", lives: 25 },
            { id: 7, x: 300, y: 600, color: "blue", lives: 25 },
            { id: 8, x: 700, y: 600, color: "blue", lives: 25 }
        ]
    }
};

let currentLevel = 1;
let cells = [];
let flakes = [];



function clearAllLinks() {
    activeLinks = [];
}

/**
 * Inicializuje vybraný level a připraví objekty buněk.
 */
function loadLevel(levelNumber) {
    clearAllLinks();
    soldiers = [];
    selectedCell = null;
    snapTarget = null;
    cells = [];
    currentLevel = levelNumber;

    const level = levels[levelNumber];
    if (!level) return;

    level.cells.forEach(function(c) {
        const owner = c.color === "green" ? 1 : c.color === "purple" ? 2 : 0;
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
    if (ov === null) return;
    const msg = document.getElementById("winMessage");
    if (msg !== null) {
        msg.textContent = "Level " + currentLevel + " dokončen";
    }
    ov.classList.remove("hidden");
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

function winGame() {
    onLevelWin();
}

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
    const progress = JSON.parse(localStorage.getItem("progress")) || {};
    progress["level" + levelNumber] = true;
    localStorage.setItem("progress", JSON.stringify(progress));

    try {
        if (typeof window.updateLevelButtons === 'function') window.updateLevelButtons();
        if (typeof window.renderAchievements === 'function') window.renderAchievements();
    } catch (e) {}
}

const backToMenuBtn = document.getElementById("backToMenuBtn");
if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', function() {
        try { clearAllLinks(); } catch (e) {}
        soldiers = [];
        selectedCell = null;
        snapTarget = null;
        gameOver = false;
        gamePaused = false;
        gameWon = false;
        levelWon = false;
        flakes = [];

        const ov = document.getElementById("winOverlay");
        if (ov) ov.classList.add("hidden");

        window.location.href = "index.html";
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

    /**
     * Vykreslí buňku na plátno. Použije obrázek, pokud je k dispozici,
     * jinak vykreslí základní barevný kruh.
     */
    draw() {
        let img;
        if (this.owner === 1) {
            img = imgPlayer;
        } else if (this.owner === 2) {
            img = imgEnemy;
        } else {
            img = imgNeutral;
        }

        ctx.save();
        if (img && img.complete && img.naturalWidth !== 0) {
            ctx.globalCompositeOperation = "screen";
            ctx.drawImage(
                img,
                this.x - this.radius,
                this.y - this.radius,
                this.radius * 2,
                this.radius * 2
            );
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            if (this.owner === 1) ctx.fillStyle = "#2ecc71";
            else if (this.owner === 2) ctx.fillStyle = "#9b59b6";
            else ctx.fillStyle = "#3498db";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.stroke();
        }

        if (this === selectedCell || this.underAttack) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.lineWidth = 4;
            if (this === selectedCell) {
                ctx.strokeStyle = "rgba(0, 255, 136, 0.7)";
            } else {
                ctx.strokeStyle = "rgba(255, 100, 100, 0.6)";
            }
            ctx.stroke();
        }

        ctx.restore();

        // Vykreslení textu s počtem vojáků uprostřed buňky
        ctx.fillStyle = "white";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.fillText(this.soldiers, this.x, this.y + 5);
        ctx.shadowBlur = 0;
    }
}


/**
 * Najde nejbližší buňku k daným souřadnicím.
 */
function findClosestCell(x, y, expandedRadius = false) {
    let closest = null;
    let closestDist = Infinity;
    const radiusFactor = expandedRadius ? snapRadius : null;

    for (let c of cells) {
        const dist = Math.hypot(x - c.x, y - c.y);
        const detectionRadius = expandedRadius ? (c.radius + 60) : (c.radius + 10);
        if (dist < detectionRadius && dist < closestDist) {
            closest = c;
            closestDist = dist;
        }
    }
    return closest;
}

/**
 * Matematická funkce pro detekci
 *pro klikání na linky
 */
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

/**
 * Vyšle jednoho vojáka z buňky do buňky.
 */
function sendSoldiers(from, to) {
    if (from.soldiers <= 0) return;
    from.soldiers -= 1;
    soldiers.push({
        x: from.x,
        y: from.y,
        targetCell: to,
        speed: 4,
        type: from.owner === 1 ? 'player' : 'enemy',
        owner: from.owner,
        from: from
    });
}

/**
 * Spustí aktivní link mezi dvěma buňkami.
 */
function startAutoSend(from, to) {
    if (activeLinks.some(function(link) { return link.from === from && link.to === to; })) return;
    activeLinks.push({ from, to, owner: from.owner });
}

function stopAutoSendToTarget(target) {
    activeLinks = activeLinks.filter(function(link) {
        return link.to !== target;
    });
}

function generujVojakyZLinku() {
    if (gamePaused || gameOver) return;
    activeLinks.forEach(function(link) {
        if (link.from.soldiers > 1) {
            link.from.soldiers -= 1;
            soldiers.push({
                x: link.from.x,
                y: link.from.y,
                targetCell: link.to,
                speed: 4,
                type: link.owner === 1 ? 'player' : 'enemy',
                owner: link.owner,
                from: link.from
            });
        }
    });
}

setInterval(generujVojakyZLinku, 500);



canvas.addEventListener("mousemove", function(e) {
    const rect = canvas.getBoundingClientRect();
    lastMouse.x = e.clientX - rect.left;
    lastMouse.y = e.clientY - rect.top;

    if (selectedCell) {
        const snapped = findClosestCell(lastMouse.x, lastMouse.y, true);
        if (snapped && snapped !== selectedCell) snapTarget = snapped;
        else snapTarget = null;
    }
}, { passive: true });

canvas.addEventListener('pointerdown', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedLink = activeLinks.find(function(link) {
        return isPointNearLine(x, y, link.from, link.to, 8);
    });
    if (clickedLink) {
        if (socket !== null && typeof odesliAkci === 'function') {
            odesliAkci({
                typ: "zrusit_linku",
                od: clickedLink.from.id,
                na: clickedLink.to.id
            });
        } else {
            activeLinks = activeLinks.filter(function(l) { return l !== clickedLink; });
        }
        return;
    }

    if (selectedCell && snapTarget) {
        if (selectedCell.owner !== 1) {
            selectedCell = null;
            snapTarget = null;
            return;
        }

        const existing = activeLinks.find(function(l) {
            return l.from === selectedCell && l.to === snapTarget;
        });

        if (socket !== null && typeof odesliAkci === 'function') {
            if (existing) {
                odesliAkci({
                    typ: "zrusit_linku",
                    od: selectedCell.id,
                    na: snapTarget.id
                });
            } else {
                odesliAkci({
                    typ: "linka",
                    od: selectedCell.id,
                    na: snapTarget.id
                });
            }
        } else {
            if (existing) {
                activeLinks = activeLinks.filter(function(l) {
                    return !(l.from === selectedCell && l.to === snapTarget);
                });
            } else {
                startAutoSend(selectedCell, snapTarget);
            }
        }

        snapTarget = null;
        selectedCell = null;
        return;
    }

    const c = findClosestCell(x, y, true);
    if (c === null) {
        selectedCell = null;
        snapTarget = null;
        return;
    }

    if (c.owner === 1) {
        selectedCell = selectedCell === c ? null : c;
    }
}, { passive: true }); 


/**
 * Hlavní funkce pro aktualizaci pozic vojáků a řešení kolizí s buňkami.
 * Implementuje také vizuální zobrazení vojáků.
 */
function updateSoldiers() {
    for (let i = soldiers.length - 1; i >= 0; i--) {
        const s = soldiers[i];
        const targetCell = s.targetCell;
        const dx = targetCell.x - s.x;
        const dy = targetCell.y - s.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) {
            handleCellHit(s, targetCell);
            soldiers.splice(i, 1);
            continue;
        }

        const moveX = dx / dist * s.speed;
        const moveY = dy / dist * s.speed;
        s.x += moveX;
        s.y += moveY;

        if (s.owner === 2 && imgEnemySoldier.complete) {
            ctx.drawImage(imgEnemySoldier, s.x - 12, s.y - 12, 24, 24);
        } else {
            ctx.beginPath();
            ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = s.owner === 1 ? "#00ff88" : "white";
            ctx.fill();
        }
    }
}

function handleCellHit(soldier, cell) {
    if (!cell) return;

    if (cell.owner === soldier.owner) {
        cell.soldiers++;
        if (cell.soldiers > cell.maxSoldiers) {
            cell.soldiers = cell.maxSoldiers;
        }
    } else {
        cell.underAttack = true;
        cell.soldiers--;
        if (cell.soldiers <= 0) {
            cell.owner = soldier.owner;
            if (cell.owner === 1) cell.color = "green";
            else if (cell.owner === 2) cell.color = "purple";
            else cell.color = "blue";

            cell.soldiers = 5;
            cell.underAttack = false;

            if (selectedCell === cell) {
                selectedCell = null;
                snapTarget = null;
            }

            activeLinks = activeLinks.filter(function(link) {
                return link.from !== cell && link.to !== cell;
            });
        }
    }
}


/**
 * Pravidelně doplňuje vojáky do buněk, které nejsou pod útokem.
 */
setInterval(function() {
    if (gamePaused || gameOver) return;
    for (let c of cells) {
        if (!c.underAttack && c.soldiers < c.maxSoldiers) {
            c.soldiers += 1;
        }
        c.underAttack = false;
    }
}, 800);



 
setInterval(function() {
    if (gamePaused || gameOver) return;
    const enemies = cells.filter(function(c) { return c.owner === 2 && c.soldiers > 5; });
    const targets = cells.filter(function(c) { return c.owner !== 2; });
    if (targets.length === 0 || enemies.length === 0) return;

    for (let enemy of enemies) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        sendSoldiers(enemy, target);
    }
}, 800);


function checkGameEnd() {
    if (gameOver) return;
    const hasGreen = cells.some(function(c) { return c.owner === 1; });
    const hasPurple = cells.some(function(c) { return c.owner === 2; });

    if (!hasGreen) loseGame();
    if (!hasPurple && cells.every(function(c) { return c.owner === 1; })) winGame();
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
    rulesButton.addEventListener("click", function() {
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

    // Pozadí hry
    if (imgBackground.complete && imgBackground.naturalWidth !== 0) {
        ctx.drawImage(imgBackground, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#0a0a2a"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Průhledná textura navrch
    if (imgBackgroundTop.complete && imgBackgroundTop.naturalWidth !== 0) {
        ctx.globalAlpha = 0.3;
        ctx.drawImage(imgBackgroundTop, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // Aktivní linky 
    for (let link of activeLinks) {
        ctx.beginPath();
        ctx.moveTo(link.from.x, link.from.y);
        ctx.lineTo(link.to.x, link.to.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Preview linka při tažení myší
    if (selectedCell) {
        ctx.beginPath();
        ctx.moveTo(selectedCell.x, selectedCell.y);
        if (snapTarget) ctx.lineTo(snapTarget.x, snapTarget.y);
        else ctx.lineTo(lastMouse.x, lastMouse.y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Vykreslení buněk
    for (let c of cells) c.draw();

    // Logika za běhu hry
    if (!gameOver && !gamePaused) {
        updateSoldiers();
        checkGameEnd();
    }

    // Efekt konfet při vítězství
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



// Načtení levelu z backendu nebo z URL parametrů
try {
    // Pokud jsou data z Djanga (šablona game.html), použij je
    if (typeof LEVEL_DATA !== 'undefined' && LEVEL_DATA && LEVEL_ID !== undefined) {
        // Nahradit level z backendu do levels objektu
        levels[LEVEL_ID] = LEVEL_DATA;
        loadLevel(LEVEL_ID);
    } else {
        // Fallback na URL parametry pro starší verzi
        const urlParams = new URLSearchParams(window.location.search);
        const levelParam = parseInt(urlParams.get('level'), 10);
        if (!isNaN(levelParam)) loadLevel(levelParam);
        else loadLevel(1);
    }
} catch (e) {
    console.error("Chyba při načítání levelu:", e);
    loadLevel(1);
}

// Počkáme na načtení všech grafických assetů a pak spustíme hru
Promise.all([
    nactiObrazek(imgPlayer),
    nactiObrazek(imgEnemy),
    nactiObrazek(imgNeutral),
    nactiObrazek(imgEnemySoldier), // NAČTENÍ NOVÉHO OBRÁZKU VOJÁKA
    nactiObrazek(imgBackground),
    nactiObrazek(imgBackgroundTop)
]).then(function() {
    console.log("Všechny obrázky načteny, spouštím hru...");
    draw();
});

