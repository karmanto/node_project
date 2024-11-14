const { Client, NoAuth } = require('whatsapp-web.js');
const {
    fetchUnconnectedClients,
    resetClientData,
    updateQRCode,
    updateNoMatchNumber,
    updateClientConnected,
    fetchCustomersByUserId,
    fetchCustomerAddersByUserId
} = require('./dbService');

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
        const customers = await fetchCustomersByUserId(session.user_id);
        const customerAdders = await fetchCustomerAddersByUserId(session.user_id);

        if (customerAdders.length > 0) {
            for (const adder of customerAdders) {
                const isFromMe = message.fromMe;

                if ((adder.trigger_from === 0 && isFromMe) || (adder.trigger_from === 1 && !isFromMe)) {
                    if (message.body.includes(adder.trigger_message)) {
                        const phoneNumber = message.from.split('@')[0];
                        const customerExists = customers.some(customer => customer.whatsapp_number === phoneNumber);

                        if (!customerExists) {
                            const connection = await initDB();
                            await connection.execute(
                                'INSERT INTO customers (user_id, chatbot_whatsapp_id, whatsapp_number, name, deleted_at) VALUES (?, ?, ?, ?, NULL)',
                                [session.user_id, session.id, phoneNumber, "user " + phoneNumber]
                            );
                            connection.end();
                            console.log(`New customer added with user ID ${session.user_id} and phone number ${phoneNumber}`);
                            break;
                        }
                    }
                }
            }
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