const { Client, NoAuth } = require('whatsapp-web.js');
const mysql = require('mysql2/promise');
const qrcode = require('qrcode-terminal');

let clients = {};

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
        'UPDATE chatbot_whatsapps SET qrcode = NULL, whatsapp_number = NULL, is_connect = 0 WHERE deleted_at IS NULL'
    );
    connection.end();
}

async function updateQRCode(clientId, qrCode) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = ?, whatsapp_number = NULL, is_connect = 0 WHERE id = ? AND deleted_at IS NULL',
        [qrCode, clientId]
    );
    connection.end();
}

async function updateClientConnected(clientId, whatsappNumber) {
    const connection = await initDB();
    try {
        await connection.execute(
            'UPDATE chatbot_whatsapps SET qrcode = NULL, is_connect = 1, whatsapp_number = ? WHERE id = ? AND deleted_at IS NULL',
            [whatsappNumber, clientId]
        );
    } catch (error) {
        console.error(`Failed to update client connected for ID ${clientId}:`, error.message);

        if (error.code === 'ER_DUP_ENTRY') {
            console.log(`Duplicate whatsappNumber found for client ID ${clientId}. Disconnecting session.`);
            
            if (clients[clientId]) {
                clients[clientId].destroy();
                delete clients[clientId];
            }
        }
    } finally {
        connection.end();
    }
}

function createClient(session) {
    const client = new Client({
        authStrategy: new NoAuth()
    });

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
            let userId = message.from;
            client.sendMessage(userId, message.body);
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
            clients[session.id] = createClient(session);
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
