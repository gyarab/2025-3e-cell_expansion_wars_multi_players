document.addEventListener('DOMContentLoaded', function() {

    const loginForm = document.getElementById("loginForm");
    const userPanel = document.getElementById("userPanel");
    const welcomeText = document.getElementById("welcomeText");
    const message = document.getElementById("loginMessage");
    const username = document.getElementById("username");
    const password = document.getElementById("password");

    function setAuthUI(isLoggedIn) {
        if (loginForm) loginForm.classList.toggle("hidden", isLoggedIn);
        if (userPanel) userPanel.classList.toggle("hidden", !isLoggedIn);
    }

    async function register() {
        const user = username ? username.value.trim() : "";
        const pass = password ? password.value.trim() : "";

        if (!user || !pass) {
            if (message) { message.textContent = "Vyplň jméno a heslo"; message.style.color = "#f55"; }
            return;
        }

        const formData = new FormData();
        formData.append("username", user);
        formData.append("password", pass);

        const resp = await fetch("/register/", {
            method: "POST",
            body: formData,
            headers: { "X-CSRFToken": getCsrfToken() }
        });
        const text = await resp.text();

        if (text === "success") {
            if (message) { message.style.color = "#5f5"; message.textContent = "Registrace hotová, přihlas se"; }
            if (username) username.value = "";
            if (password) password.value = "";
        } else {
            if (message) { message.style.color = "#f55"; message.textContent = "Registrace selhala, zkus jiné jméno"; }
        }
    }

    async function login() {
        const user = username ? username.value.trim() : "";
        const pass = password ? password.value.trim() : "";

        const formData = new FormData();
        formData.append("username", user);
        formData.append("password", pass);

        const resp = await fetch("/login/", {
            method: "POST",
            body: formData,
            headers: { "X-CSRFToken": getCsrfToken() }
        });
        
        let data;
        try {
            data = await resp.json();
        } catch(e) {
            if (message) { message.textContent = "Chyba serveru"; message.style.color = "#f55"; }
            return;
        }

        if (data.status === "success") {
            if (username) username.value = "";
            if (password) password.value = "";
            if (message) message.textContent = "";
            if (welcomeText) welcomeText.textContent = "Hello, " + data.username;
            setAuthUI(true);

            // Načti progress ze serveru
            if (data.progress && typeof data.progress === "object") {
                window.progressCache = data.progress;
            } else {
                await loadProgress();
            }

            updateLevelButtons();
            if (typeof renderAchievements === 'function') renderAchievements();
        } else {
            if (message) { message.textContent = data.error || "Špatné přihlášení"; message.style.color = "#f55"; }
        }
    }

    async function logout() {
        const uid = window.location.pathname.match(/user(\d+)/)?.[1] ?? "0";
        await fetch("/user" + uid + "/logout/", {
            method: "POST",
            headers: { "X-CSRFToken": getCsrfToken() }
        });
        setAuthUI(false);
        if (username) username.value = "";
        if (password) password.value = "";
        if (message) message.textContent = "";
        window.progressCache = null;
        if (typeof updateLevelButtons === 'function') updateLevelButtons();
    }

    window.progressCache = null;

    async function loadProgress() {
        try {
            const resp = await fetch("/progress/load/");
            if (!resp.ok) throw new Error("load failed");
            const data = await resp.json();
            window.progressCache = (data && typeof data.progress === "object") ? data.progress : {};
        } catch (e) {
            window.progressCache = window.progressCache || {};
        }
        return window.progressCache;
    }

    async function saveProgress(progress) {
        window.progressCache = progress || {};
        try {
            await fetch("/progress/save/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken()
                },
                body: JSON.stringify({ progress: window.progressCache })
            });
        } catch (e) {
            console.warn("Progress save failed", e);
        }
    }

    function getProgress() {
        return window.progressCache || {};
    }

    async function saveWin(levelNumber) {
        const progress = getProgress();
        progress["level" + levelNumber] = true;
        await saveProgress(progress);
        if (typeof window.updateLevelButtons === 'function') window.updateLevelButtons();
        if (typeof window.renderAchievements === 'function') window.renderAchievements();
    }

    function isLevelCompleted(level) {
        return getProgress()["level" + level] === true;
    }

    function isLevelUnlocked(level) {
        if (level === 1) return true;
        return getProgress()["level" + (level - 1)] === true;
    }

    function renderAchievements() {
        const list = document.getElementById("achievementsList");
        if (!list) return;
        list.innerHTML = "";
        const names = { 1: "Rookie — Level 1", 2: "All-Star — Level 2", 3: "Legend — Level 3" };
        [1, 2, 3].forEach(function(level) {
            const dokoncen = isLevelCompleted(level);
            const radek = document.createElement("div");
            radek.className = "achievement-item" + (dokoncen ? " gold" : "");
            radek.innerHTML = "<span>" + (dokoncen ? "🏆" : "🔒") + "</span><span>" + (dokoncen ? "✅ " : "❌ ") + names[level] + (dokoncen ? " — dokončen" : " — nedokončen") + "</span>";
            list.appendChild(radek);
        });
        if (isLevelCompleted(1) && isLevelCompleted(2) && isLevelCompleted(3)) {
            const bonus = document.createElement("div");
            bonus.className = "achievement-item gold";
            bonus.innerHTML = "<span>🎉</span><span>Dokončil jsi všechny tři levely, pojď zkusit multiplayer!</span>";
            list.appendChild(bonus);
        }
    }

    function openAchievements() {
        window.gamePaused = true;
        const popup = document.getElementById("achievementsPopup");
        if (popup) popup.classList.remove("hidden");
        renderAchievements();
    }

    function closeAchievements() {
        window.gamePaused = false;
        const popup = document.getElementById("achievementsPopup");
        if (popup) popup.classList.add("hidden");
    }

    function updateLevelButtons() {
        const tlacitka = document.querySelectorAll(".level-btn");
        tlacitka.forEach(function(tlacitko) {
            const level = Number(tlacitko.dataset.level);
            tlacitko.classList.remove('locked', 'unlocked', 'completed');
            if (isLevelCompleted(level)) {
                tlacitko.classList.add("completed");
                tlacitko.disabled = false;
                tlacitko.textContent = "LEVEL " + level + " 🏆";
                tlacitko.onclick = function() { location.href = "/game.html?level=" + level; };
            } else if (isLevelUnlocked(level)) {
                tlacitko.classList.add("unlocked");
                tlacitko.disabled = false;
                tlacitko.textContent = "LEVEL " + level;
                tlacitko.onclick = function() { location.href = "/game.html?level=" + level; };
            } else {
                tlacitko.classList.add("locked");
                tlacitko.disabled = true;
                tlacitko.textContent = "LEVEL " + level;
                tlacitko.onclick = null;
            }
        });
    }

    function getCsrfToken() {
        const name = "csrftoken";
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(name + "=")) return cookie.substring(name.length + 1);
        }
        return "";
    }

    // Globální funkce
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
    window.loadProgress = loadProgress;

    // Inicializace — pokud je uživatel přihlášen (Django šablona ho zobrazila)
    const loggedInUsername = welcomeText ? welcomeText.textContent.trim() : "";
    if (loggedInUsername) {
        setAuthUI(true);
        loadProgress().then(() => {
            updateLevelButtons();
            renderAchievements();
        });
    } else {
        updateLevelButtons();
    }

    // Po návratu ze hry (pageshow)
    window.addEventListener("pageshow", async () => {
        const isLoggedIn = !!(welcomeText ? welcomeText.textContent.trim() : "");
        if (isLoggedIn) {
            setAuthUI(true);
            await loadProgress();
            updateLevelButtons();
            renderAchievements();
        }
    });

});