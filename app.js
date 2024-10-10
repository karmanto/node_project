const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let clients = {};

function createSession(sessionId) {
    console.log(`Creating session: ${sessionId}`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: sessionId // Nama direktori sesi
        })
    });

    client.on('qr', (qr) => {
        console.log(`QR code for session ${sessionId}:`);
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log(`Client for session ${sessionId} is ready!`);
    });

    client.on('authenticated', () => {
        console.log(`Client for session ${sessionId} authenticated successfully.`);
    });

    client.on('auth_failure', () => {
        console.error(`Authentication failed for session ${sessionId}.`);
    });

    client.on('disconnected', (reason) => {
        console.log(`Client for session ${sessionId} disconnected: ${reason}`);
    });

    client.on('message_create', async message => {
        if (!message.fromMe) {
            client.sendMessage(message.from, message.body);
        }
    });

    client.initialize();
    clients[sessionId] = client;

    return client;
}

// Fungsi untuk menghancurkan sesi
function destroySession(sessionId) {
    const sessionPath = path.join(__dirname, `.wwebjs_auth/session-${sessionId}`);

    // Cek apakah client sedang berjalan
    if (clients[sessionId]) {
        console.log(`Destroying client for session ${sessionId}`);
        
        // Hentikan client
        clients[sessionId].destroy().then(() => {
            console.log(`Client for session ${sessionId} destroyed.`);
            
            // Hapus data sesi dari disk
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`Session ${sessionId} has been destroyed from disk.`);
            } else {
                console.log(`Session ${sessionId} does not exist on disk.`);
            }

            // Hapus client dari objek
            delete clients[sessionId];
        }).catch(err => {
            console.error(`Error destroying client for session ${sessionId}:`, err);
        });
    } else {
        console.log(`Client for session ${sessionId} does not exist.`);
    }
}

// Contoh membuat dan menghancurkan sesi
const session1 = createSession('session1');
// const session2 = createSession('session2');

// Hancurkan sesi setelah 1 menit (contoh)
setTimeout(() => {
    // destroySession('session1');
    // destroySession('session2');
}, 60000); // 1 menit