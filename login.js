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

    function getProgress() {
        return JSON.parse(localStorage.getItem("progress")) || {};
    }

    function isLevelCompleted(level) {
        const progress = getProgress();
        return !!progress[`level${level}`];
    }

    function isLevelUnlocked(level) {
        if (Number(level) === 1) return true;
        const progress = getProgress();
        return !!progress[`level${Number(level) - 1}`];
    }

    function achievementText(level, name) {
        const progress = getProgress();
        return progress[`level${level}`]
            ? `🏆 ${name} — dokončen`
            : `🔒 ${name} — nedokončen`;
    }

    function renderAchievements() {
        const list = document.getElementById("achievementsList");
        if (!list) return;
        list.innerHTML = "";

        const names = {
            1: "Rookie — Level 1",
            2: "All-Star — Level 2",
            3: "Legend — Level 3"
        };

        [1,2,3].forEach(level => {
            const completed = isLevelCompleted(level);
            const row = document.createElement("div");
            row.className = "achievement-item";
            if (completed) row.classList.add("gold");

            row.innerHTML = `
                <span class="emoji">${completed ? "🏆" : "🔒"}</span>
                <span>${achievementText(level, names[level])}</span>
            `;

            list.appendChild(row);
        });
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

    function updateLevelButtons() {
        document.querySelectorAll(".level-btn").forEach(btn => {
            const level = Number(btn.dataset.level);

            // reset classes
            btn.classList.remove('locked','unlocked','completed');

            if (isLevelCompleted(level)) {
                btn.classList.add("completed");
                btn.disabled = false;
                btn.textContent = `LEVEL ${level} 🏆`;
                btn.onclick = () => location.href = `game.html?level=${level}`;
            } else if (isLevelUnlocked(level)) {
                btn.classList.add("unlocked");
                btn.disabled = false;
                btn.textContent = `LEVEL ${level}`;
                btn.onclick = () => location.href = `game.html?level=${level}`;
            } else {
                btn.classList.add("locked");
                btn.disabled = true;
                btn.textContent = `LEVEL ${level}`;
                btn.onclick = () => {};
            }
        });
    }

    // expose functions to global scope so other code can call them
    window.register = register;
    window.login = login;
    window.logout = logout;
    window.hasWon = isLevelCompleted; // back-compat
    window.isLevelCompleted = isLevelCompleted;
    window.renderAchievements = renderAchievements;
    window.updateLevelButtons = updateLevelButtons;
    window.openAchievements = openAchievements;
    window.closeAchievements = closeAchievements;

    showUser();
});