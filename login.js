document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById("loginForm");
    const userPanel = document.getElementById("userPanel");
    const welcomeText = document.getElementById("welcomeText");
    const message = document.getElementById("loginMessage");
    const username = document.getElementById("username");
    const password = document.getElementById("password");

    function register() {
        const user = username.value.trim();
        const pass = password.value.trim();

        if (!user || !pass) {
            message.textContent = "Vyplň jméno a heslo";
            message.style.color = "#f55";
            return;
        }

        localStorage.setItem("user_" + user, pass);

        message.style.color = "#5f5";
        message.textContent = "Registrace hotová, přihlas se";

        // ✅ clear inputs after register
        username.value = "";
        password.value = "";
    }

    function login() {
        const user = username.value.trim();
        const pass = password.value.trim();
        const stored = localStorage.getItem("user_" + user);

        if (stored === pass) {
            localStorage.setItem("loggedUser", user);

            // ✅ clear inputs after login
            username.value = "";
            password.value = "";
            message.textContent = "";

            showUser();
        } else {
            message.textContent = "Špatné přihlášení";
            message.style.color = "#f55";
        }
    }

    function logout() {
        localStorage.removeItem("loggedUser");

        // ✅ clear inputs so nothing stays visible
        username.value = "";
        password.value = "";
        message.textContent = "";

        loginForm.classList.remove("hidden");
        userPanel.classList.add("hidden");
    }

    function showUser() {
        const user = localStorage.getItem("loggedUser");
        if (user) {
            if (loginForm) loginForm.classList.add("hidden");
            if (userPanel) userPanel.classList.remove("hidden");
            if (welcomeText) welcomeText.textContent = "Hello, " + user;
        }
    }

    function hasWon(levelNumber) {
        const user = localStorage.getItem("loggedUser");
        if (!user) return false;

        const progress = JSON.parse(localStorage.getItem("wins_" + user)) || {};
        return progress["level" + levelNumber] === true;
    }

    function openAchievements() {
        if (typeof window !== 'undefined') window.gamePaused = true;
        const achievementsPopup = document.getElementById("achievementsPopup");
        if (!achievementsPopup) return;
        achievementsPopup.classList.remove("hidden");
        renderAchievements();
    }

    function closeAchievements() {
        if (typeof window !== 'undefined') window.gamePaused = false;
        const achievementsPopup = document.getElementById("achievementsPopup");
        if (!achievementsPopup) return;
        achievementsPopup.classList.add("hidden");
    }

    function renderAchievements() {
        const list = document.getElementById("achievementsList");
        if (!list) return;
        list.innerHTML = "";

        const achievements = [
            { level: 1, icon: "🥉", title: "Rookie", desc: "Level 1 dokončen" },
            { level: 2, icon: "🥈", title: "All-Star", desc: "Level 2 dokončen" },
            { level: 3, icon: "🥇", title: "Legend", desc: "Level 3 dokončen" }
        ];

        achievements.forEach(a => {
            const row = document.createElement("div");

            if (hasWon(a.level)) {
                row.textContent = `${a.icon} ${a.title} — ${a.desc}`;
                row.style.color = "gold";
            } else {
                row.textContent = `🔒 ${a.title} — ${a.desc}`;
                row.style.color = "#666";
            }

            row.style.fontSize = "18px";
            row.style.margin = "12px 0";

            list.appendChild(row);
        });
    }

    // expose functions to global scope so onclick attributes work
    window.register = register;
    window.login = login;
    window.logout = logout;
    window.hasWon = hasWon;
    window.openAchievements = openAchievements;
    window.closeAchievements = closeAchievements;

    showUser();
});