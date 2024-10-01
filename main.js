const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = 'sessions.json';

const client = new Client({
    authStrategy: new LocalAuth()
});

const readSessions = () => {
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(path));
};

const saveSessions = (sessions) => {
    fs.writeFileSync(path, JSON.stringify(sessions, null, 2));
};

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message_create', message => {
    let sessions = readSessions();
    let userId = message.from;

    if (!sessions[userId]) {
        sessions[userId] = { session: 'none' };
    }

    let userSession = sessions[userId];

    switch (userSession.session) {
        case 'none':
            if (message.body.toLowerCase() === 'start') {
                client.sendMessage(userId, 'Terima kasih atas partisipasinya. Silahkan masukkan nama anda.');
                userSession.session = 'waiting_for_name';
            }
            break;

        case 'waiting_for_name':
            userSession.name = message.body;
            client.sendMessage(userId, `Terima kasih ${userSession.name}, sekarang masukkan alamat anda.`);
            userSession.session = 'waiting_for_address';
            break;

        case 'waiting_for_address':
            userSession.address = message.body;
            client.sendMessage(userId, 'Terima kasih, sekarang masukkan jumlah pesanan anda.');
            userSession.session = 'waiting_for_order_count';
            break;

        case 'waiting_for_order_count':
            userSession.orderCount = message.body;
            client.sendMessage(userId, `Terima kasih ${userSession.name}, pesanan anda sejumlah ${userSession.orderCount} telah diterima dengan alamat: ${userSession.address}.`);
            userSession.session = 'completed';
            break;

        case 'completed':
            client.sendMessage(userId, 'Sesi anda sudah selesai. Jika ingin memulai lagi, ketik "start".');
            break;

        default:
            client.sendMessage(userId, 'Silahkan ketik "start" untuk memulai.');
            break;
    }

    sessions[userId] = userSession;
    saveSessions(sessions);
});

client.initialize();

process.on("SIGINT", async () => {
    console.log("(SIGINT) Shutting down...");
    await client.destroy();
    process.exit(0);
});
