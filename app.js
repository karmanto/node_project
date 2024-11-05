const { Client, NoAuth } = require('whatsapp-web.js');
const { cekResi } = require('./cek-resi-jne');
const mysql = require('mysql2/promise');

let clients = {};

const isNumericString = (str) => {
    const parts = str.split("\n");
    return parts.every(part => /^\d+$/.test(part));
};

async function initDB() {
    return await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'crm'
    });
}

async function fetchUnconnectedClients() {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM chatbot_whatsapps WHERE deleted_at IS NULL'
    );
    connection.end();
    return rows;
}

async function resetClientData() {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = NULL, whatsapp_number_linked = NULL, is_connect = 0 WHERE deleted_at IS NULL'
    );
    connection.end();
}

async function updateQRCode(clientId, qrCode) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = ?, whatsapp_number_linked = NULL, is_connect = 0 WHERE id = ? AND deleted_at IS NULL',
        [qrCode, clientId]
    );
    connection.end();
}

async function updateNoMatchNumber(clientId) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = NULL, whatsapp_number_linked = NULL, is_connect = 0 WHERE id = ? AND deleted_at IS NULL',
        [clientId]
    );
    connection.end();
}

async function updateClientConnected(clientId, whatsappNumber) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = NULL, is_connect = 1, whatsapp_number_linked = ? WHERE id = ? AND deleted_at IS NULL',
        [whatsappNumber, clientId]
    );
    connection.end();
}

function createClient(session) {
    const client = new Client({
        authStrategy: new NoAuth()
    });

    client.isChecking = false;

    client.on('qr', (qr) => {
        updateQRCode(session.id, qr);
    });

    client.on('ready', async () => {
        console.log(`Client ID ${session.id} is ready!`);
        const phoneNumber = client?.info?.wid?.user;
        if (phoneNumber) {
            await updateClientConnected(session.id, phoneNumber);
        }
    });

    client.on('authenticated', () => {
        console.log(`Client ID ${session.id} authenticated successfully.`);
    });

    client.on('auth_failure', () => {
        console.error(`Authentication failed for client ID ${session.id}.`);
    });

    client.on('disconnected', (reason) => {
        console.log(`Client ID ${session.id} disconnected: ${reason}`);
        clients[session.id].destroy(); 
        delete clients[session.id];
    });

    client.on('message_create', async message => {
        if (!message.fromMe) {
            // if (isNumericString(message.body) && !client.isChecking) {
            //     client.isChecking = true;
            //     try {
            //         await client.sendMessage(message.from, "data sedang diproses");
            //         const response = await cekResi(message);
            //         if (response.status === "success") {
            //             await client.sendMessage(message.from, response.data);
            //         } else {
            //             await client.sendMessage(message.from, response.message);
            //         }

            //         client.isChecking = false;
            //     } catch (error) {
            //         console.error("Error during cekResi process:", error);
            //     } 

            // } else if (client.isChecking) {
            //     client.sendMessage(message.from, "sistem sedang memproses resi lain");
            // } else {
            //     client.sendMessage(message.from, "resi tidak valid");
            // }
            client.sendMessage(message.from, message.body);
        }
    });

    client.initialize();
    return client;
}

async function initializeUnconnectedClients() {
    const sessions = await fetchUnconnectedClients();
    const activeClientIds = sessions.map(session => session.id);

    for (const session of sessions) {
        if (!clients[session.id]) {
            if (session.is_active) {
                clients[session.id] = createClient(session);
            }
        } else {
            if (session.is_connect && session.whatsapp_number !== session.whatsapp_number_linked) {
                console.log(`Deleting session for client ID ${session.id} as it no match with whatsapp_number.`);
                updateNoMatchNumber(session.id);
                clients[session.id].destroy(); 
                delete clients[session.id];
            } else if (!session.is_active) {
                console.log(`Deleting session for client ID ${session.id} as it has been nonactive.`);
                updateNoMatchNumber(session.id);
                clients[session.id].destroy(); 
                delete clients[session.id];
            }
        }
    }

    for (const clientId in clients) {
        if (!activeClientIds.includes(Number(clientId))) {
            console.log(`Deleting session for client ID ${clientId} as it has been deleted.`);
            clients[clientId].destroy(); 
            delete clients[clientId];
        }
    }
}

resetClientData().then(() => {
    setInterval(initializeUnconnectedClients, 2000);
}).catch(err => {
    console.error('Failed to reset client data:', err);
});
