

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

function zpracujAkci(data) {
    console.log("Přijatá akce z backendu:", data);

    // 1. Zpracování vytvoření linku mezi buňkami
    if (data.type === 'vytvor_link') {
        // cells je pole objektů buněk, které máš definované a vykresluješ v main.js
        // Najdeme konkrétní objekty buněk podle ID doručených ze serveru
        const zdrojovaBunka = cells.find(c => c.id === data.fromCellId);
        const cilovaBunka = cells.find(c => c.id === data.toCellId);

        if (zdrojovaBunka && cilovaBunka) {
            // Zde zavoláme funkci z tvého původního main.js, která vytváří spojení.
            // Například přidání do pole aktivních spojení:
            activeLinks.push({
                from: zdrojovaBunka,
                to: cilovaBunka,
                owner: data.senderUserId
            });
            
            console.log(`Link vytvořen od buňky ${zdrojovaBunka.id} do ${cilovaBunka.id}`);
        }
    }

    // 2. Zpracování zásahu buňky vojákem (synchronizace životů)
    if (data.type === 'aktualizace_zivotu') {
        const targetCell = cells.find(c => c.id === data.cellId);
        if (targetCell) {
            targetCell.lives = data.noveLives;
            targetCell.color = data.novaBarva; // Změna barvy, pokud buňku někdo dobyl
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
        // Přesměrujeme hráče na multiplayerovou URL, kde view vrátí game.html a automaticky se připojíme na WS
        window.location.href = "/user" + uid + "/preset" + pid + "/game" + novaGameId + "/";

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