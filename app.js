const { Client, NoAuth } = require('whatsapp-web.js');
const {
    fetchUnconnectedClients,
    resetClientData,
    updateQRCode,
    updateNoMatchNumber,
    updateClientConnected,
    isUserActive
} = require('./dbService');
const { addCustomerIfNotExists } = require('./cek-customer');
const { checkAndCreateAwb } = require('./cek-awb');
const { checkChatbotSchedule } = require('./cek-chatbot-schedule');

let clients = {};

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
        if (await isUserActive(session.user_id)) {
            await addCustomerIfNotExists(session, message);
            await checkAndCreateAwb(session, message);
            await checkChatbotSchedule(session, message);
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