const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const HEARTBEAT_TIMEOUT_MS = 10_000;
const REMOVE_USER_AFTER_MS = 60_000;
const CHECK_INTERVAL_MS = 1_000;

const API_KEYS = new Set([
    "KEY-123",
    "KEY-456"
]);

// key -> { id, name, lastSeen, online }
const users = new Map();
let warnedAboutMissingWebhook = false;

function validKey(key) {
    return API_KEYS.has(key);
}

function cleanText(value, maxLength = 100) {
    return String(value ?? "").trim().slice(0, maxLength);
}

function getOnlineUsers(now = Date.now()) {
    return [...users.values()].filter(user =>
        user.online && now - user.lastSeen <= HEARTBEAT_TIMEOUT_MS
    );
}

function playerLabel(user) {
    return user.name || "Неизвестный игрок";
}

function rosterText(list) {
    if (!list.length) return "Никого нет в сети";

    const lines = list.map(user =>
        `${playerLabel(user)} — ${user.id || "ID не передан"}`
    );

    const result = lines.join("\n");

    return result.length > 1024
        ? `${result.slice(0, 1000)}\n…список сокращён`
        : result;
}

async function sendDiscordEmbed({ joined, user, reason }) {
    if (!WEBHOOK_URL) {
        if (!warnedAboutMissingWebhook) {
            console.warn(
                "DISCORD_WEBHOOK_URL не задан — уведомления Discord отключены."
            );

            warnedAboutMissingWebhook = true;
        }

        return;
    }

    const now = Date.now();
    const onlineUsers = getOnlineUsers(now);

    const fields = [
        {
            name: "👤 Ник",
            value: playerLabel(user).slice(0, 256),
            inline: true
        },
        {
            name: "🆔 ID",
            value: String(user.id || "Не передан клиентом").slice(0, 256),
            inline: true
        },
        {
            name: "👥 Сейчас онлайн",
            value: String(onlineUsers.length),
            inline: true
        }
    ];

    if (!joined) {
        fields.push({
            name: "📴 Причина",
            value: reason || "heartbeat timeout (>10s)",
            inline: false
        });
    }

    fields.push({
        name: joined
            ? "👥 Кто ещё в сети"
            : "👥 Кто остался в сети",
        value: rosterText(onlineUsers),
        inline: false
    });

    const payload = {
        username: "Script Online",
        allowed_mentions: {
            parse: []
        },
        embeds: [
            {
                title: "Script Online",
                description: joined
                    ? "🟢 **Игрок запустил скрипт**"
                    : "🔴 **Игрок отключился**",
                color: joined ? 0x2ECC71 : 0xED4245,
                fields,
                footer: {
                    text: "CUCUMBER • Online Tracker"
                },
                timestamp: new Date(now).toISOString()
            }
        ]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const responseText = await response.text();

            console.error(
                `Discord webhook failed: ${response.status} ${responseText.slice(0, 300)}`
            );
        }
    } catch (error) {
        console.error("Discord webhook error:", error.message);
    }
}

function page(content, title = "Сайт") {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>${title}</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 40px;
            background: #000;
            color: #fff;
            font-family: Arial, sans-serif;
        }

        h1, h2, h3 {
            color: #fff;
        }

        p {
            color: #fff;
        }

        a {
            color: #fff;
        }

        button,
        input {
            background: #111;
            color: #fff;
            border: 1px solid #444;
            padding: 10px;
        }
    </style>
</head>

<body>
    ${content}

    <script>
        const titles = [
            "i",
            "id",
            "idi",
            "idi ",
            "idi n",
            "idi na",
            "idi nah",
            "idi nahu",
            "idi nahui"
        ];

        let i = 0;

        setInterval(() => {
            document.title = titles[i];
            i = (i + 1) % titles.length;
        }, 200);
    </script>
</body>
</html>
    `;
}

app.get("/", (req, res) => {
    res.send(page(`
        <h1>IDI NAHUI</h1>

        <p>idi!</p>

        <p>
            nahui
        </p>

        <p>
            idi nahui
        </p>
    `, "^_____^"));
});

app.get("/ping", (req, res) => {
    const key = req.query.key;
    const userValue = cleanText(req.query.user, 150);

    if (!validKey(key)) {
        return res
            .status(403)
            .send("Invalid API Key or PASOL NAHUI UEBAK");
    }

    if (!userValue) {
        return res
            .status(400)
            .send("Missing user or PASOL NAHUI UEBAK");
    }

    const suppliedId = cleanText(
        req.query.id ?? req.query.userId ?? req.query.robloxId,
        32
    );

    const id = suppliedId ||
        (/^\d+$/.test(userValue) ? userValue : "");

    const suppliedName = cleanText(
        req.query.name ?? req.query.username,
        80
    );

    const displayName = cleanText(
        req.query.displayName ?? req.query.displayname,
        80
    );

    const name = suppliedName
        ? (
            displayName && displayName !== suppliedName
                ? `${suppliedName}(${displayName})`
                : suppliedName
        )
        : userValue;

    const userKey = id || userValue;
    const now = Date.now();

    let previous = users.get(userKey);

    // If a heartbeat returns after the old session timed out,
    // report that old exit first.
    if (
        previous?.online &&
        now - previous.lastSeen > HEARTBEAT_TIMEOUT_MS
    ) {
        previous.online = false;

        void sendDiscordEmbed({
            joined: false,
            user: previous,
            reason: "heartbeat timeout (>10s)"
        });
    }

    const newSession = !previous || !previous.online;

    const currentUser = {
        id: id || previous?.id || "",
        name: name || previous?.name || userValue,
        lastSeen: now,
        online: true
    };

    users.set(userKey, currentUser);

    if (newSession) {
        void sendDiscordEmbed({
            joined: true,
            user: currentUser
        });
    }

    res.send("pasol nahui at suda");
});

app.get("/online", (req, res) => {
    res.json({
        online: getOnlineUsers(Date.now()).length
    });
});

setInterval(() => {
    const now = Date.now();

    for (const [id, user] of users) {
        const age = now - user.lastSeen;

        if (
            user.online &&
            age > HEARTBEAT_TIMEOUT_MS
        ) {
            user.online = false;

            void sendDiscordEmbed({
                joined: false,
                user,
                reason: "heartbeat timeout (>10s)"
            });
        }

        // Keep the original cleanup window so stale records
        // are eventually removed.
        if (
            !user.online &&
            age > REMOVE_USER_AFTER_MS
        ) {
            users.delete(id);
        }
    }
}, CHECK_INTERVAL_MS);

app.listen(PORT, () => {
    console.log(`API started on port ${PORT}`);
});
