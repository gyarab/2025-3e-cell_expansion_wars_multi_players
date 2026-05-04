

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");



const imgPlayer = new Image();
imgPlayer.src = "cell_player.png";

const imgEnemy = new Image();
imgEnemy.src = "cell_enemy.png";

const imgNeutral = new Image();
imgNeutral.src = "cell_neutral.png";

// NOVÝ OBRÁZEK PRO NEPŘÁTELSKÉ VOJÁKY
const imgEnemySoldier = new Image();
imgEnemySoldier.src = "cell_enemy_soldier.png";

const imgBackgroundTop = new Image();
imgBackgroundTop.src = "cellwars_background_top.png";

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
let activeSoldiers = [];        // Pole objektů reprezentujících vojáky v pohybu
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
    for (let link of activeLinks) {
        clearInterval(link.interval);
    }
    activeLinks = [];
}

/**
 * Inicializuje vybraný level a připraví objekty buněk.
 */
function loadLevel(levelNumber) {
    clearAllLinks();
    activeSoldiers = [];
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
        const detectionRadius = expandedRadius ? radiusFactor : c.radius;
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
    activeSoldiers.push({
        x: from.x,
        y: from.y,
        target: to,
        owner: from.owner,
        from: from
    });
}

/**
 * Spustí periodické vysílání vojáků mezi dvěma buňkami.
 */
function startAutoSend(from, to) {
    if (activeLinks.some(function(link) { return link.from === from && link.to === to; })) return;

    const interval = setInterval(function() {
        if (!gamePaused) sendSoldiers(from, to);
    }, 500);

    activeLinks.push({ from, to, interval });
}

function stopAutoSendToTarget(target) {
    activeLinks = activeLinks.filter(function(link) {
        if (link.to === target) {
            clearInterval(link.interval);
            return false;
        }
        return true;
    });
}



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
        clearInterval(clickedLink.interval);
        activeLinks = activeLinks.filter(function(l) { return l !== clickedLink; });
        return;
    }

    if (selectedCell && snapTarget) {
        const existing = activeLinks.find(function(l) {
            return l.from === selectedCell && l.to === snapTarget;
        });
        if (existing) {
            clearInterval(existing.interval);
            activeLinks = activeLinks.filter(function(l) {
                return !(l.from === selectedCell && l.to === snapTarget);
            });
        } else {
            startAutoSend(selectedCell, snapTarget);
        }
        snapTarget = null;
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

canvas.addEventListener("click", function() {
    const clickedLink = activeLinks.find(function(link) {
        return isPointNearLine(lastMouse.x, lastMouse.y, link.from, link.to, 8);
    });
    if (clickedLink) {
        clearInterval(clickedLink.interval);
        activeLinks = activeLinks.filter(function(l) { return l !== clickedLink; });
        return;
    }

    if (selectedCell && snapTarget) {
        const existing = activeLinks.find(function(l) {
            return l.from === selectedCell && l.to === snapTarget;
        });
        if (existing) {
            clearInterval(existing.interval);
            activeLinks = activeLinks.filter(function(l) {
                return !(l.from === selectedCell && l.to === snapTarget);
            });
        } else {
            startAutoSend(selectedCell, snapTarget);
        }
        snapTarget = null;
        return;
    }

    const c = findClosestCell(lastMouse.x, lastMouse.y, true);
    if (c === null) {
        selectedCell = null;
        snapTarget = null;
        return;
    }

    if (c.owner === 1) {
        selectedCell = selectedCell === c ? null : c;
    }
});



/**
 * Hlavní funkce pro aktualizaci pozic vojáků a řešení kolizí s buňkami.
 * Implementuje také vizuální zobrazení vojáků.
 */
function updateSoldiers() {
    for (let s of [...activeSoldiers]) {
        const dx = s.target.x - s.x;
        const dy = s.target.y - s.y;
        const dist = Math.hypot(dx, dy);

        // Pokud voják dorazil do cíle
        if (dist < 5) {
            if (s.owner === s.target.owner) {
                // Přátelské posily
                s.target.soldiers++;
                if (s.target.soldiers > s.target.maxSoldiers) {
                    s.target.soldiers = s.target.maxSoldiers;
                }
            } else {
                // Nepřátelský útok
                s.target.underAttack = true;
                s.target.soldiers--;
                if (s.target.soldiers <= 0) {
                    // Buňka byla dobyta
                    s.target.owner = s.owner;
                    if (s.target.owner === 1) s.target.color = "green";
                    else if (s.target.owner === 2) s.target.color = "purple";
                    else s.target.color = "blue";

                    s.target.soldiers = 5;
                    s.target.underAttack = false;

                    // Zrušení všech linků spojených s dobytou buňkou
                    activeLinks = activeLinks.filter(function(link) {
                        if (link.from === s.target || link.to === s.target) {
                            clearInterval(link.interval);
                            return false;
                        }
                        return true;
                    });
                }
            }
            activeSoldiers.splice(activeSoldiers.indexOf(s), 1);
            continue;
        }

        // Samotný pohyb vojáka směrem k cíli
        s.x += dx / dist * 4;
        s.y += dy / dist * 4;

        // --- UPRAVENÉ VYKRESLOVÁNÍ VOJÁKA ---
        if (s.owner === 2 && imgEnemySoldier.complete) {
            // Pokud je to nepřítel  vykresli tvůj obrázek 
            // Velikost 24x24 (střed je s.x, s.y)
            ctx.drawImage(imgEnemySoldier, s.x - 12, s.y - 12, 24, 24); 
        } else {
            // Pokud je to hráč (owner 1) nebo neutrální, použij kuličku
            ctx.beginPath();
            ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = s.owner === 1 ? "#00ff88" : "white";
            ctx.fill();
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



// Načtení levelu z URL parametrů
try {
    const urlParams = new URLSearchParams(window.location.search);
    const levelParam = parseInt(urlParams.get('level'), 10);
    if (!isNaN(levelParam)) loadLevel(levelParam);
    else loadLevel(1);
} catch (e) {
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

