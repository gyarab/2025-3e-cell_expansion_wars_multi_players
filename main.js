const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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

// ------------------- KONFIGURACE LEVELŮ -------------------
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
    // LEVEL 3: stejná struktura jako level 1 a 2.
    // Hráč (white) má 60 životů jako v levelu 2.
    // Přidány 2 černé buňky (enemy) a 1 extra bílá buňka — obě se 60 životy jako v levelu 2.
    // Navíc 3 neutrální modré buňky a celkem 5 nepřátel (3 black).
    3: {
        cells: [
            // --- Hráčovy buňky (bílé) ---
            { id: 1, x: 100, y: 150, color: "white", lives: 60 }, // hlavní základna
            { id: 2, x: 200, y: 600, color: "white", lives: 60 }, // druhá bílá buňka (stejně jako v levelu 2)

            // --- Nepřátelé (černé) — 2 původní + 2 nové = celkem 4 ---
            { id: 3, x: 800, y: 150, color: "black", lives: 30 }, // černá 1 (stejně jako level 2)
            { id: 4, x: 600, y: 550, color: "black", lives: 30 }, // černá 2 (stejně jako level 2)
            { id: 5, x: 900, y: 500, color: "black", lives: 30 }, // nová černá buňka 1
            // nová černá buňka 2

            // --- Neutrální (modré) ---
            { id: 7, x: 400, y: 100, color: "blue",  lives: 20 },
            { id: 8, x: 500, y: 400, color: "blue",  lives: 20 },
            { id: 9, x: 300, y: 700, color: "blue",  lives: 20 }
        ]
    }
};

let currentLevel = 1;

/**
 * clearAllLinks — vymaže všechny aktivní linky (spojení) mezi buňkami.
 * Zastaví všechny intervaly, aby vojáci přestali automaticky odcházet.
 */
function clearAllLinks() {
    for (let link of activeLinks) {
        clearInterval(link.interval);
    }
    activeLinks = [];
}

/**
 * loadLevel — načte zadaný level.
 * Resetuje stav hry, vytvoří buňky podle konfigurace a nastaví výchozí hodnoty.
 * @param {number} levelNumber - číslo levelu (1, 2 nebo 3)
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

/**
 * showWinNotification — zobrazí overlay s oznámením o výhře.
 * Pozastaví hru a vypíše číslo dokončeného levelu.
 */
function showWinNotification() {

    // najdeme výherní overlay na stránce
    const ov = document.getElementById("winOverlay");

    // pokud overlay existuje, provedeme vše uvnitř
    if (ov !== null) {

        // najdeme element kde se zobrazí zpráva o výhře
        const msg = document.getElementById("winMessage");

        // pokud element existuje, zapíšeme do něj text
        if (msg !== null) {
            msg.textContent = "Level " + currentLevel + " dokončen";
        }

        // zobrazíme overlay odebráním třídy hidden
        ov.classList.remove("hidden");

        // pozastavíme hru
        gamePaused = true;
    }
}

/**
 * onLevelWin — zpracuje výhru v levelu.
 * Nastaví stav výhry, uloží postup a zobrazí výherní overlay.
 * Ochrana před dvojím spuštěním pomocí příznaku levelWon.
 */
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

/**
 * winGame — deleguje výhru na onLevelWin.
 * Slouží jako veřejné rozhraní pro vyvolání výhry.
 */
function winGame() {
    onLevelWin();
}

/**
 * loseGame — zpracuje prohru.
 * Nastaví stav prohry a zobrazí overlay s textem "YOU LOSE".
 */
function loseGame() {
    if (gameOver) return;
    gameOver = true;
    gameResult = "lose";
    gamePaused = true;
    showEndOverlay("YOU LOSE", "The enemy took over everything.");
}

// zlaté konfety při výhře
let flakes = [];

/**
 * spawnFlake — vytvoří jednu zlatou konfetu na náhodné pozici nahoře.
 * Každá konfeta má náhodnou rychlost a velikost.
 */
function spawnFlake() {
    flakes.push({
        x: Math.random() * canvas.width,
        y: -10,
        speed: 1 + Math.random() * 3,
        size: 3 + Math.random() * 4
    });
}

/**
 * saveWin — uloží výhru v daném levelu.
 * CHEAT: tato funkce je záložní — login.js ji přepíše svojí verzí přes window.saveWin
 * Pokud je hráč přihlášen, login.js uloží výhru pod "progress_jméno"
 * Pokud nikdo není přihlášen (nepřihlášený hráč), uloží do obecného "progress"
 * @param {number} levelNumber - číslo dokončeného levelu
 */
function saveWin(levelNumber) {
    // CHEAT: window.saveWin může být přepsáno login.js = per-user ukládání
    // pokud login.js není načteno, použije se tato záložní verze
    if (window.saveWin && window.saveWin !== saveWin) {
        window.saveWin(levelNumber);
        return;
    }

    // CHEAT: záložní verze — ukládá do společného klíče (nepřihlášený hráč)
    const progress = JSON.parse(localStorage.getItem("progress")) || {};
    progress[`level${levelNumber}`] = true;
    localStorage.setItem("progress", JSON.stringify(progress));

    try {
        if (typeof window.updateLevelButtons === 'function') window.updateLevelButtons();
        if (typeof window.renderAchievements === 'function') window.renderAchievements();
    } catch (e) {}
}

/**
 * goToFrontPage — přesměruje hráče na hlavní stránku (index.html).
 */
function goToFrontPage() {
    location.href = 'index.html';
}

/**
 * hideWinPopup — skryje starý výherní popup (legacy).
 * Obnoví hru a vymaže konfety.
 */
function hideWinPopup() {
    const wp = document.getElementById("winPopup");
    if (wp) wp.classList.add("hidden");
    gamePaused = false;
    gameWon = false;
    flakes = [];
}

// kliknutí na starý popup ho skryje
const winPopupEl = document.getElementById("winPopup");
if (winPopupEl) {
    winPopupEl.addEventListener('click', hideWinPopup);
}

// tlačítko "Zpět do menu" v novém win overlay
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

        window.location.href = "index.html";
    });
}

// ------------------- TŘÍDA CELL (BUŇKA) -------------------
class Cell {
    /**
     * constructor — vytvoří novou buňku na zadané pozici.
     * @param {number} x - pozice X středu buňky
     * @param {number} y - pozice Y středu buňky
     * @param {number} radius - poloměr buňky v pixelech
     * @param {string} color - barva buňky ("white", "black", "blue")
     * @param {number} owner - vlastník: 0 = neutrální, 1 = hráč, 2 = počítač
     */
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
     * draw — vykreslí buňku na canvas.
     * Zobrazí kruh v barvě buňky a počet vojáků uvnitř.
     */
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.fillStyle = this.color === "white" ? "black" : "white";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.soldiers, this.x, this.y + 5);
    }
}

// ------------------- POMOCNÉ FUNKCE -------------------

/**
 * findClosestCell — najde nejbližší buňku k dané souřadnici.
 * @param {number} x - souřadnice X
 * @param {number} y - souřadnice Y
 * @param {boolean} expandedRadius - pokud true, použije větší oblast detekce (snapRadius)
 * @returns {Cell|null} nejbližší buňka nebo null
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
 * isPointNearLine — zjistí, jestli je bod (x, y) blízko úsečky od a do b.
 * Používá se pro klikání na linky mezi buňkami.
 * @param {number} x - souřadnice X bodu
 * @param {number} y - souřadnice Y bodu
 * @param {{x,y}} a - začátek úsečky
 * @param {{x,y}} b - konec úsečky
 * @param {number} threshold - maximální vzdálenost pro detekci (px)
 * @returns {boolean}
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
 * sendSoldiers — odešle jednoho vojáka z buňky `from` do buňky `to`.
 * Pokud zdrojová buňka nemá vojáky, nic neudělá.
 * @param {Cell} from - zdrojová buňka
 * @param {Cell} to - cílová buňka
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
 * startAutoSend — spustí automatické odesílání vojáků z buňky `from` do `to`.
 * Každých 500 ms odešle jednoho vojáka (pokud hra není pozastavena).
 * Zabrání duplicitnímu spojení (stejné from → to).
 * @param {Cell} from - zdrojová buňka
 * @param {Cell} to - cílová buňka
 */
function startAutoSend(from, to) {
    if (activeLinks.some(link => link.from === from && link.to === to)) return;

    const interval = setInterval(() => {
        if (!gamePaused) sendSoldiers(from, to);
    }, 500);

    activeLinks.push({ from, to, interval });
}

/**
 * stopAutoSendToTarget — zastaví všechny automatické linky směřující do cílové buňky.
 * Volá se při dobytí buňky, aby se přerušily zastaralé linky.
 * @param {Cell} target - cílová buňka, ke které se mají přerušit linky
 */
function stopAutoSendToTarget(target) {
    activeLinks = activeLinks.filter(link => {
        if (link.to === target) {
            clearInterval(link.interval);
            return false;
        }
        return true;
    });
}

// ------------------- BUŇKY -------------------
let cells = [];

// načti level podle URL parametru ?level=, jinak defaultně level 2
try {
    const urlParams = new URLSearchParams(window.location.search);
    const levelParam = parseInt(urlParams.get('level'), 10);
    if (!isNaN(levelParam)) loadLevel(levelParam);
    else loadLevel(2);
} catch (e) {
    loadLevel(2);
}

// ------------------- UDÁLOSTI MYŠI -------------------

/**
 * mousemove — sleduje pohyb myši a aktualizuje snap cíl.
 * Pokud je vybrána buňka, hledá nejbližší buňku pro přichycení linie.
 */
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

/**
 * pointerdown — zpracuje kliknutí/dotyk na canvas.
 * Přepíná linky mezi buňkami nebo vybírá hráčovu buňku.
 */
canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedLink = activeLinks.find(link => isPointNearLine(x, y, link.from, link.to, 8));
    if (clickedLink) {
        clearInterval(clickedLink.interval);
        activeLinks = activeLinks.filter(l => l !== clickedLink);
        return;
    }

    if (selectedCell && snapTarget) {
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
        selectedCell = null;
        snapTarget = null;
        return;
    }

    if (c.owner === 1) {
        selectedCell = selectedCell === c ? null : c;
    }
}, { passive: true });

/**
 * click — zpracuje kliknutí myší (záložní handler vedle pointerdown).
 * Logika je stejná jako u pointerdown.
 */
canvas.addEventListener("click", () => {
    const clickedLink = activeLinks.find(link => isPointNearLine(lastMouse.x, lastMouse.y, link.from, link.to, 8));
    if (clickedLink) {
        clearInterval(clickedLink.interval);
        activeLinks = activeLinks.filter(l => l !== clickedLink);
        return;
    }

    if (selectedCell && snapTarget) {
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

    const c = findClosestCell(lastMouse.x, lastMouse.y, true);

    if (!c) {
        selectedCell = null;
        snapTarget = null;
        return;
    }

    if (c.owner === 1) {
        selectedCell = selectedCell === c ? null : c;
    }
});

// ------------------- POHYB VOJÁKŮ -------------------

/**
 * updateSoldiers — pohybuje vojáky směrem k cíli a vyřeší útok nebo posilu.
 * Pokud voják dosáhne cíle:
 *   - stejný vlastník → posílí buňku
 *   - jiný vlastník  → sníží počet vojáků, při 0 dobyde buňku
 */
function updateSoldiers() {
    for (let s of [...activeSoldiers]) {
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
                    if (s.target.owner === 1)      s.target.color = "white";
                    else if (s.target.owner === 2) s.target.color = "black";
                    else                           s.target.color = "blue";

                    s.target.soldiers = 5;
                    s.target.underAttack = false;

                    // přeruš linky spojené s dobytou buňkou
                    activeLinks = activeLinks.filter(link => {
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

        s.x += dx / dist * 4;
        s.y += dy / dist * 4;

        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = s.owner === 1 ? "white" : s.owner === 2 ? "orange" : "lightblue";
        ctx.fill();
    }
}

// ------------------- REGENERACE VOJÁKŮ -------------------
/**
 * Interval regenerace — každých 800 ms doplní vojáky v buňkách, které nejsou napadeny.
 * Pozastaví se při gamePaused nebo gameOver.
 */
setInterval(() => {
    if (gamePaused || gameOver) return;

    for (let c of cells) {
        if (!c.underAttack && c.soldiers < c.maxSoldiers) {
            c.soldiers += 1;
        }
        c.underAttack = false;
    }
}, 800);

// ------------------- AI POČÍTAČE -------------------
/**
 * Interval AI — každých 800 ms pošle vojáky z černých buněk na náhodný cíl.
 * Útočí jen buňky s více než 5 vojáky.
 * Pozastaví se při gamePaused nebo gameOver.
 */
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

// ------------------- KONTROLA KONCE HRY -------------------

/**
 * checkGameEnd — zkontroluje, jestli hra skončila výhrou nebo prohrou.
 * Výhra: všechny buňky jsou bílé (hráčovy).
 * Prohra: hráč nemá žádnou bílou buňku.
 */
function checkGameEnd() {
    if (gameOver) return;

    const hasWhite = cells.some(c => c.color === "white");
    const hasBlack = cells.some(c => c.color === "black");

    if (!hasWhite) loseGame();
    if (!hasBlack && cells.every(c => c.color === "white")) winGame();
}

/**
 * showEndOverlay — zobrazí overlay s výsledkem hry (výhra/prohra).
 * @param {string} title - nadpis (např. "YOU LOSE")
 * @param {string} text - doplňující text pod nadpisem
 */
function showEndOverlay(title, text) {
    const overlay = document.getElementById("endOverlay");
    const titleEl = document.getElementById("endTitle");
    const textEl = document.getElementById("endText");

    if (!overlay || !titleEl || !textEl) return;

    titleEl.textContent = title;
    textEl.textContent = text;

    overlay.classList.remove("hidden");
}

// ------------------- PRAVIDLA -------------------
const rulesButton = document.getElementById("rulesButton");
const rulesOverlay = document.getElementById("rulesOverlay");

if (rulesButton && rulesOverlay) {
    rulesButton.addEventListener("click", () => {
        rulesOverlay.classList.remove("hidden");
        gamePaused = true;
    });
}

/**
 * closeRules — zavře overlay s pravidly a obnoví hru.
 */
function closeRules() {
    if (rulesOverlay) rulesOverlay.classList.add("hidden");
    gamePaused = false;
}

// ------------------- HLAVNÍ SMYČKA KRESLENÍ -------------------

/**
 * draw — hlavní vykreslovací smyčka (requestAnimationFrame).
 * Vykresluje linky, náhled linie, buňky, vojáky, konfety.
 * Volá updateSoldiers a checkGameEnd při aktivní hře.
 */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // aktivní linky (bílé čáry)
    for (let link of activeLinks) {
        ctx.beginPath();
        ctx.moveTo(link.from.x, link.from.y);
        ctx.lineTo(link.to.x, link.to.y);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // náhled čáry při výběru buňky
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

    // zlaté konfety při výhře
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