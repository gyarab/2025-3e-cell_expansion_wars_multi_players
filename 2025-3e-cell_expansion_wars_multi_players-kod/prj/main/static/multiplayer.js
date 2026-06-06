

let socket = null;
let gameId = null;
let presetId = null;
let userId = null;

// Připojení na WebSocket po vytvoření hry
function pripojWebSocket(uid, pid, gid) {
    userId = uid;
    presetId = pid;
    gameId = gid;

    // sestavíme WebSocket adresu
    const wsUrl = "ws://" + window.location.host + "/ws/user" + uid + "/preset" + pid + "/game" + gid + "/";

    socket = new WebSocket(wsUrl);

    // WebSocket se úspěšně připojil
    socket.onopen = function() {
        console.log("WebSocket připojen na hru " + gameId);
    };

    // přijatá zpráva od serveru - druhý hráč udělal akci
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        zpracujAkci(data);
    };

    // WebSocket se odpojil
    socket.onclose = function() {
        console.log("WebSocket odpojen");
        socket = null;
    };

    // chyba WebSocket
    socket.onerror = function(error) {
        console.error("WebSocket chyba:", error);
    };
}

// Odeslání akce přes WebSocket na server
function odesliAkci(akce) {
    if (socket !== null && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(akce));
    }
}

// Zpracování přijaté akce od druhého hráče
function zpracujAkci(data) {
    // pokud druhý hráč vytvořil linku
    if (data.typ === "linka") {
        const od = cells.find(function(c) { return c.id === data.od; });
        const na = cells.find(function(c) { return c.id === data.na; });
        if (od && na) {
            startAutoSend(od, na);
        }
    }

    // pokud druhý hráč zrušil linku
    if (data.typ === "zrusit_linku") {
        const od = cells.find(function(c) { return c.id === data.od; });
        const na = cells.find(function(c) { return c.id === data.na; });
        if (od && na) {
            activeLinks = activeLinks.filter(function(link) {
                if (link.from === od && link.to === na) {
                    clearInterval(link.interval);
                    return false;
                }
                return true;
            });
        }
    }
}

// Vytvoření nové multiplayerové hry přes HTTP
// Zavolá se když hráč klikne na tlačítko multiplayeru
async function vytvorHru(uid, pid) {
    try {
        const response = await fetch("/user" + uid + "/preset" + pid + "/", {
            method: "POST",
            headers: {
                "X-CSRFToken": ziskejCsrfToken()
            }
        });

        const text = await response.text();

        if (text === "fail") {
            console.error("Nepodařilo se vytvořit hru - nejsi přihlášen?");
            return;
        }

        // server vrátil ID nové hry
        const novaGameId = text.trim();
        pripojWebSocket(uid, pid, novaGameId);

    } catch (error) {
        console.error("Chyba při vytváření hry:", error);
    }
}

// Pomocná funkce pro získání CSRF tokenu z cookie
function ziskejCsrfToken() {
    const name = "csrftoken";
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(name + "=")) {
            return cookie.substring(name.length + 1);
        }
    }
    return "";
}