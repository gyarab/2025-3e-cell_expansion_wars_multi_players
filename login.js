document.addEventListener('DOMContentLoaded', function() {

    // najdeme všechny elementy na stránce které budeme používat
    const loginForm = document.getElementById("loginForm");
    const userPanel = document.getElementById("userPanel");
    const welcomeText = document.getElementById("welcomeText");
    const message = document.getElementById("loginMessage");
    const username = document.getElementById("username");
    const password = document.getElementById("password");

    //uloží nového uživatele
    function register() {
        const user = username.value.trim();
        const pass = password.value.trim();

        // zkontrolujeme jestli jsou pole vyplněná
        if (!user || !pass) {
            message.textContent = "Vyplň jméno a heslo";
            message.style.color = "#f55";
            return;
        }

        // uložíme uživatele do localStorage
        localStorage.setItem("user_" + user, pass);

        // vytvoříme prázdný progress pro tohoto uživatele
        const existujiciProgress = localStorage.getItem("progress_" + user);
        if (existujiciProgress === null) {
            localStorage.setItem("progress_" + user, JSON.stringify({}));
        }

        message.style.color = "#5f5";
        message.textContent = "Registrace hotová, přihlas se";

        // vyčistíme pole
        username.value = "";
        password.value = "";
    }

    // ověří uživatele a přihlásí ho
    function login() {
        const user = username.value.trim();
        const pass = password.value.trim();

        // načteme uložené heslo pro tohoto uživatele
        const ulozeneHeslo = localStorage.getItem("user_" + user);

        // porovnáme hesla
        if (ulozeneHeslo === pass) {
            // heslo sedí - přihlásíme uživatele
            localStorage.setItem("loggedUser", user);

            // vyčistíme pole
            username.value = "";
            password.value = "";
            message.textContent = "";

            // zobrazíme panel přihlášeného uživatele
            showUser();

            // aktualizujeme tlačítka levelů
            if (typeof updateLevelButtons === 'function') {
                updateLevelButtons();
            }
        } else {
            // heslo nesedí - zobrazíme chybu
            message.textContent = "Špatné přihlášení";
            message.style.color = "#f55";
        }
    }

    //odhlásí uživatele
    function logout() {
        // smažeme přihlášeného uživatele
        localStorage.removeItem("loggedUser");

        // vyčistíme pole
        username.value = "";
        password.value = "";
        message.textContent = "";

        // zobrazíme přihlašovací formulář
        loginForm.classList.remove("hidden");
        userPanel.classList.add("hidden");

        // aktualizujeme tlačítka levelů
        if (typeof updateLevelButtons === 'function') {
            updateLevelButtons();
        }
    }

    // zkontroluje localStorage a zobrazí panel
    function showUser() {
        const user = localStorage.getItem("loggedUser");

        if (user) {
            if (loginForm) {
                loginForm.classList.add("hidden");
            }
            if (userPanel) {
                userPanel.classList.remove("hidden");
            }
            if (welcomeText) {
                welcomeText.textContent = "Hello, " + user;
            }
        }
    }

    //vrátí jméno nebo null
    function getLoggedUser() {
        const user = localStorage.getItem("loggedUser");
        return user;
    }

    // ZÍSKÁNÍ PROGRESSU - načte postup přihlášeného hráče
    function getProgress() {
        // zjistíme kdo je přihlášen
        const user = getLoggedUser();

        // pokud nikdo není přihlášen, vrátíme prázdný objekt
        if (!user) {
            return {};
        }

        // vytvoříme klíč pro tohoto hráče
        const klic = "progress_" + user;

        // načteme data z localStorage
        const data = localStorage.getItem(klic);

        // pokud tam nic není, vrátíme prázdný objekt
        if (data === null) {
            return {};
        }

        // převedeme text na objekt a vrátíme ho
        const progress = JSON.parse(data);
        return progress;
    }

    //uloží postup přihlášeného hráče
    function saveProgress(progress) {
        const user = getLoggedUser();

        // pokud nikdo není přihlášen, nic neukládáme
        if (!user) {
            return;
        }

        // vytvoříme klíč pro tohoto hráče
        const klic = "progress_" + user;

        // převedeme objekt na text a uložíme
        const data = JSON.stringify(progress);
        localStorage.setItem(klic, data);
    }

    // uloží dokončený level
    function saveWin(levelNumber) {
        // načteme aktuální postup hráče
        const progress = getProgress();

        // vytvoříme název klíče pro tento level
        const nazevLevelu = "level" + levelNumber;

        // označíme level jako dokončený
        progress[nazevLevelu] = true;

        // uložíme zpět
        saveProgress(progress);

        // aktualizujeme tlačítka a achievementy
        if (typeof window.updateLevelButtons === 'function') {
            window.updateLevelButtons();
        }
        if (typeof window.renderAchievements === 'function') {
            window.renderAchievements();
        }
    }

    // vrátí true nebo false
    function isLevelCompleted(level) {
        const progress = getProgress();
        const nazevLevelu = "level" + level;
        const dokoncen = progress[nazevLevelu];

        if (dokoncen) {
            return true;
        } else {
            return false;
        }
    }

    // JE LEVEL ODEMČEN? - vrátí true nebo false
    function isLevelUnlocked(level) {
        // level 1 je vždy odemčený
        if (level === 1) {
            return true;
        }

        // načteme postup hráče
        const progress = getProgress();

        // zjistíme číslo předchozího levelu
        const predchoziLevel = level - 1;
        const nazevPredchoziho = "level" + predchoziLevel;

        // zkontrolujeme jestli byl předchozí level dokončen
        const predchoziDokoncen = progress[nazevPredchoziho];

        if (predchoziDokoncen) {
            return true;
        } else {
            return false;
        }
    }

    // TEXT PRO ACHIEVEMENT - vrátí text podle toho jestli je level dokončen
    function achievementText(level, name) {
        const progress = getProgress();
        const nazevLevelu = "level" + level;
        const dokoncen = progress[nazevLevelu];

        if (dokoncen) {
            return "✅ " + name + " — dokončen";
        } else {
            return "❌ " + name + " — nedokončen";
        }
    }

    // zobrazí seznam achievementů
    function renderAchievements() {
        const list = document.getElementById("achievementsList");
        if (!list) {
            return;
        }

        // vyčistíme seznam
        list.innerHTML = "";

        // názvy achievementů pro každý level
        const names = {
            1: "Rookie — Level 1",
            2: "All-Star — Level 2",
            3: "Legend — Level 3"
        };

        // projdeme všechny levely
        const levely = [1, 2, 3];
        for (let i = 0; i < levely.length; i++) {
            const level = levely[i];
            const dokoncen = isLevelCompleted(level);

            // vytvoříme řádek pro tento achievement
            const radek = document.createElement("div");
            radek.className = "achievement-item";

            if (dokoncen) {
                radek.classList.add("gold");
            }

            // přidáme obsah řádku
            if (dokoncen) {
                radek.innerHTML = "<span>🏆</span><span>" + achievementText(level, names[level]) + "</span>";
            } else {
                radek.innerHTML = "<span>🔒</span><span>" + achievementText(level, names[level]) + "</span>";
            }

            list.appendChild(radek);
        }

        // zkontrolujeme jestli jsou všechny levely dokončeny
        const level1Dokoncen = isLevelCompleted(1);
        const level2Dokoncen = isLevelCompleted(2);
        const level3Dokoncen = isLevelCompleted(3);

        if (level1Dokoncen && level2Dokoncen && level3Dokoncen) {
            const bonusRadek = document.createElement("div");
            bonusRadek.className = "achievement-item gold";
            bonusRadek.innerHTML = "<span>🎉</span><span>Dokončil jsi všechny tři levely, pojď zkusit multiplayer!</span>";
            list.appendChild(bonusRadek);
        }
    }

    //  zobrazí popup
    function openAchievements() {
        window.gamePaused = true;
        const achievementsPopup = document.getElementById("achievementsPopup");
        if (!achievementsPopup) {
            return;
        }
        achievementsPopup.classList.remove("hidden");
        renderAchievements();
    }

    // skryje popup
    function closeAchievements() {
        window.gamePaused = false;
        const achievementsPopup = document.getElementById("achievementsPopup");
        if (!achievementsPopup) {
            return;
        }
        achievementsPopup.classList.add("hidden");
    }

    // nastaví správný styl každého tlačítka
    function updateLevelButtons() {
        const tlacitka = document.querySelectorAll(".level-btn");

        for (let i = 0; i < tlacitka.length; i++) {
            const tlacitko = tlacitka[i];
            const level = Number(tlacitko.dataset.level);

            // nejdřív odebereme všechny třídy
            tlacitko.classList.remove('locked', 'unlocked', 'completed');

            if (isLevelCompleted(level)) {
                // level je dokončen - zlaté tlačítko
                tlacitko.classList.add("completed");
                tlacitko.disabled = false;
                tlacitko.textContent = "LEVEL " + level + " 🏆";
                tlacitko.onclick = function() {
                    location.href = "game.html?level=" + level;
                };
            } else if (isLevelUnlocked(level)) {
                // level je odemčen - zelené tlačítko
                tlacitko.classList.add("unlocked");
                tlacitko.disabled = false;
                tlacitko.textContent = "LEVEL " + level;
                tlacitko.onclick = function() {
                    location.href = "game.html?level=" + level;
                };
            } else {
                // level je zamčen - šedé tlačítko
                tlacitko.classList.add("locked");
                tlacitko.disabled = true;
                tlacitko.textContent = "LEVEL " + level;
                tlacitko.onclick = function() {};
            }
        }
    }

    // zpřístupníme funkce globálně pro ostatní soubory
    window.register = register;
    window.login = login;
    window.logout = logout;
    window.hasWon = isLevelCompleted;
    window.isLevelCompleted = isLevelCompleted;
    window.renderAchievements = renderAchievements;
    window.updateLevelButtons = updateLevelButtons;
    window.openAchievements = openAchievements;
    window.closeAchievements = closeAchievements;
    window.saveWin = saveWin;

    // spustíme při načtení stránky
    showUser();
    updateLevelButtons();

});