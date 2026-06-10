document.addEventListener('DOMContentLoaded', function() {

    const loginForm = document.getElementById("loginForm");
    const userPanel = document.getElementById("userPanel");
    const welcomeText = document.getElementById("welcomeText");
    const message = document.getElementById("loginMessage");
    const username = document.getElementById("username");
    const password = document.getElementById("password");

    // STARY KOD - registrace pres localStorage
    // function register() {
    //     const user = username.value.trim();
    //     const pass = password.value.trim();
    //     if (!user || !pass) {
    //         message.textContent = "Vyplň jméno a heslo";
    //         message.style.color = "#f55";
    //         return;
    //     }
    //     localStorage.setItem("user_" + user, pass);
    //     const existujiciProgress = localStorage.getItem("progress_" + user);
    //     if (existujiciProgress === null) {
    //         localStorage.setItem("progress_" + user, JSON.stringify({}));
    //     }
    //     message.style.color = "#5f5";
    //     message.textContent = "Registrace hotová, přihlas se";
    //     username.value = "";
    //     password.value = "";
    // }

    async function register() {
        const user = username.value.trim();
        const pass = password.value.trim();

        if (!user || !pass) {
            message.textContent = "Vyplň jméno a heslo";
            message.style.color = "#f55";
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
            message.style.color = "#5f5";
            message.textContent = "Registrace hotová, přihlas se";
            username.value = "";
            password.value = "";
        } else {
            message.style.color = "#f55";
            message.textContent = "Registrace selhala, zkus jiné jméno";
        }
    }

    // STARY KOD - login pres localStorage
    // function login() {
    //     const user = username.value.trim();
    //     const pass = password.value.trim();
    //     const ulozeneHeslo = localStorage.getItem("user_" + user);
    //     if (ulozeneHeslo === pass) {
    //         localStorage.setItem("loggedUser", user);
    //         username.value = "";
    //         password.value = "";
    //         message.textContent = "";
    //         showUser();
    //         if (typeof updateLevelButtons === 'function') updateLevelButtons();
    //     } else {
    //         message.textContent = "Špatné přihlášení";
    //         message.style.color = "#f55";
    //     }
    // }

    async function login() {
        const user = username.value.trim();
        const pass = password.value.trim();

        const formData = new FormData();
        formData.append("username", user);
        formData.append("password", pass);

        const resp = await fetch("/login/", {
            method: "POST",
            body: formData,
            headers: { "X-CSRFToken": getCsrfToken() }
        });
        const text = await resp.text();

        if (text === "success") {
            username.value = "";
            password.value = "";
            message.textContent = "";
            showUser(user);
            await loadProgress();
            updateLevelButtons();
            if (typeof renderAchievements === 'function') renderAchievements();
        } else {
            message.textContent = "Špatné přihlášení";
            message.style.color = "#f55";
        }
    }

    // STARY KOD - logout pres localStorage
    // function logout() {
    //     localStorage.removeItem("loggedUser");
    //     username.value = "";
    //     password.value = "";
    //     message.textContent = "";
    //     loginForm.classList.remove("hidden");
    //     userPanel.classList.add("hidden");
    //     if (typeof updateLevelButtons === 'function') updateLevelButtons();
    // }

    async function logout() {
        // uid z URL, pokud tam je, jinak 0
        const uid = window.location.pathname.match(/user(\d+)/)?.[1] ?? "0";

        await fetch("/user" + uid + "/logout/", {
            method: "POST",
            headers: { "X-CSRFToken": getCsrfToken() }
        });

        if (loginForm) loginForm.classList.remove("hidden");
        if (userPanel) userPanel.classList.add("hidden");
        if (typeof updateLevelButtons === 'function') updateLevelButtons();
    }

    // zobrazí panel přihlášeného uživatele
    // user sem přijde buď z login() nebo z šablony (all.html ho dává do welcomeText)
    function showUser(user) {
        if (!user) {
            // zkusíme přečíst ze stránky - Django ho tam dal přes šablonu
            const el = document.getElementById("welcomeText");
            if (el && el.textContent.trim() !== "") {
                if (loginForm) loginForm.classList.add("hidden");
                if (userPanel) userPanel.classList.remove("hidden");
            }
            return;
        }
        if (loginForm) loginForm.classList.add("hidden");
        if (userPanel) userPanel.classList.remove("hidden");
        if (welcomeText) welcomeText.textContent = "Hello, " + user;
    }

    // STARY KOD - progress ze localStorage
    // function getProgress() {
    //     const user = localStorage.getItem("loggedUser");
    //     if (!user) return {};
    //     const data = localStorage.getItem("progress_" + user);
    //     if (data === null) return {};
    //     return JSON.parse(data);
    // }
    //
    // function saveProgress(progress) {
    //     const user = localStorage.getItem("loggedUser");
    //     if (!user) return;
    //     localStorage.setItem("progress_" + user, JSON.stringify(progress));
    // }

    window.progressCache = null;

    async function loadProgress() {
        const user = document.getElementById("welcomeText")?.textContent.replace("Hello, ", "").trim();
        if (!user) {
            window.progressCache = {};
            return window.progressCache;
        }

        try {
            const resp = await fetch("/progress/load/");
            if (!resp.ok) throw new Error("load failed");
            const data = await resp.json();
            window.progressCache = (data && typeof data.progress === "object" && data.progress !== null) ? data.progress : {};
            return window.progressCache;
        } catch (e) {
            const data = localStorage.getItem("progress_" + user);
            try {
                window.progressCache = data ? JSON.parse(data) : {};
            } catch (err) {
                window.progressCache = {};
            }
            return window.progressCache;
        }
    }

    async function saveProgress(progress) {
        window.progressCache = progress || {};
        const user = document.getElementById("welcomeText")?.textContent.replace("Hello, ", "").trim();
        if (!user) return;

        try {
            const resp = await fetch("/progress/save/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken()
                },
                body: JSON.stringify({ progress: window.progressCache })
            });
            if (!resp.ok) throw new Error("save failed");
        } catch (e) {
            localStorage.setItem("progress_" + user, JSON.stringify(window.progressCache));
        }
    }

    function getProgress() {
        if (window.progressCache !== null) {
            return window.progressCache || {};
        }
        const user = document.getElementById("welcomeText")?.textContent.replace("Hello, ", "").trim();
        if (!user) return {};
        const data = localStorage.getItem("progress_" + user);
        if (data === null) {
            window.progressCache = {};
            return {};
        }
        try {
            window.progressCache = JSON.parse(data);
        } catch (err) {
            window.progressCache = {};
        }
        return window.progressCache;
    }

    function saveWin(levelNumber) {
        const progress = getProgress();
        progress["level" + levelNumber] = true;
        saveProgress(progress);
        if (typeof window.updateLevelButtons === 'function') window.updateLevelButtons();
        if (typeof window.renderAchievements === 'function') window.renderAchievements();
    }

    function isLevelCompleted(level) {
        const progress = getProgress();
        return progress["level" + level] === true;
    }

    function isLevelUnlocked(level) {
        if (level === 1) return true;
        return getProgress()["level" + (level - 1)] === true;
    }

    function achievementText(level, name) {
        if (isLevelCompleted(level)) return "✅ " + name + " — dokončen";
        return "❌ " + name + " — nedokončen";
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
            radek.innerHTML = "<span>" + (dokoncen ? "🏆" : "🔒") + "</span><span>" + achievementText(level, names[level]) + "</span>";
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
                tlacitko.onclick = function() { location.href = "game.html?level=" + level; };
            } else if (isLevelUnlocked(level)) {
                tlacitko.classList.add("unlocked");
                tlacitko.disabled = false;
                tlacitko.textContent = "LEVEL " + level;
                tlacitko.onclick = function() { location.href = "game.html?level=" + level; };
            } else {
                tlacitko.classList.add("locked");
                tlacitko.disabled = true;
                tlacitko.textContent = "LEVEL " + level;
                tlacitko.onclick = function() {};
            }
        });
    }

    // pomocná funkce pro CSRF token - stejná jako ziskejCsrfToken() v multiplayer.js
    function getCsrfToken() {
        const name = "csrftoken";
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(name + "=")) return cookie.substring(name.length + 1);
        }
        return "";
    }

    // globální funkce
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

    showUser();
    const loggedIn = document.getElementById("welcomeText")?.textContent.trim() !== "";
    if (loggedIn) {
        loadProgress().then(() => {
            updateLevelButtons();
            if (typeof renderAchievements === 'function') renderAchievements();
        }).catch(() => {
            updateLevelButtons();
        });
    } else {
        updateLevelButtons();
    }

});