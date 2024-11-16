require('dotenv').config();
const { Client, NoAuth, MessageMedia } = require('whatsapp-web.js');
const {
    fetchUnconnectedClients,
    resetClientData,
    updateQRCode,
    updateNoMatchNumber,
    updateClientConnected,
    isUserActive,
    fetchCustomerByPhoneNumber,
    fetchCustomersWithSchedule,
    fetchChatbotScheduleById,
    fetchChatbotDocuments,
    markCustomerRemoveScheduled
} = require('./dbService');
const { addCustomerIfNotExists } = require('./cek-customer');
const { checkAndCreateAwb } = require('./cek-awb');
const { checkChatbotSchedule } = require('./cek-chatbot-schedule');
const { cekResiJne } = require('./cek-resi');

let clients = {};

function createClient(session) {
    const client = new Client({
        authStrategy: new NoAuth()
    });

    client.on('qr', (qr) => {
        try {
            updateQRCode(session.id, qr);
        } catch (error) {
            console.log("error update QR ", error.message);
        }
    });

    client.on('ready', async () => {
        console.log(`Client ID ${session.id} is ready!`);
        const phoneNumber = client?.info?.wid?.user;
        if (phoneNumber) {
            try {
                await updateClientConnected(session.id, phoneNumber);
            } catch (error) {
                console.log("error update client connection ", error.message);
            }
        }

        setInterval(async () => {
            const customers = await fetchCustomersWithSchedule(session.user_id);
            
            for (const customer of customers) {
                const chatbotSchedule = await fetchChatbotScheduleById(customer.chatbot_schedule_id);
                if (chatbotSchedule) {
                    const documents = await fetchChatbotDocuments(chatbotSchedule.id);
                    const message = chatbotSchedule.message;

                    await client.sendMessage(`${customer.whatsapp_number}@c.us`, message);

                    for (const doc of documents) { 
                        try {
                            const media = MessageMedia.fromFilePath(process.env.LARAVEL_STORAGE_PATH + doc.filepath);
                            await client.sendMessage(`${customer.whatsapp_number}@c.us`, media);
                        } catch (error) {
                            console.log("error send media ", error.message);
                        }
                    }

                    try {
                        await markCustomerRemoveScheduled(customer.id);
                    } catch (error) {
                        console.log("error remove schedule from customer ", error.message);
                    }
                }
            }
        }, process.env.SCHEDULE_INTERVAL);
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
            const isFromMe = message.fromMe;
            const phoneNumber = isFromMe ? message.to.split('@')[0] : message.from.split('@')[0];
            const customer = await fetchCustomerByPhoneNumber(session.user_id, phoneNumber);

            if (customer) {
                await checkAndCreateAwb(session, message, customer);
                await checkChatbotSchedule(session, message);
            } else {
                await addCustomerIfNotExists(session, message);
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
                try {
                    await updateNoMatchNumber(session.id);
                } catch (error) {
                    console.log("error no match number ", error.message);
                }

                clients[session.id].destroy(); 
                delete clients[session.id];
            } else if (!session.is_active) {
                console.log(`Deleting session for client ID ${session.id} as it has been nonactive.`);
                try {
                    await updateNoMatchNumber(session.id);
                } catch (error) {
                    console.log("error no match number ", error.message);
                }

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
    setInterval(initializeUnconnectedClients, process.env.CEK_CLIENT_INTERAVAL);
    setInterval(cekResiJne, process.env.CEK_RESI_INTERVAL);
    cekResiJne();
}).catch(err => {
    console.error('Failed to reset client data:', err);
});