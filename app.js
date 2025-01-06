require('dotenv').config();
const { Client, NoAuth } = require('whatsapp-web.js');
const {
    fetchUnconnectedClients,
    resetClientData,
    updateQRCode,
    updateNoMatchNumber,
    updateClientConnected,
    isUserActive,
    fetchCustomerByUserIdAndPhoneNumber,
    fetchChatbotScheduleByUserId, 
} = require('./dbService');
const { 
    addCustomerIfNotExists,
    checkTriggerOrder,
    checkTriggerResi,
} = require('./cek-trigger');
const { sendScheduledMessages } = require('./send-schedule-messages');

let clients = {};

function createClient(session) {
    const client = new Client({
        authStrategy: new NoAuth(),
        puppeteer: {
                args: [
                        '--no-sandbox', 
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--renderer-process-limit=1',
                        '--mute-audio',
                        '--disable-software-rasterizer',
                        '--disable-sync',
                        '--aggressive-cache-discard',
                        '--disable-cache',
                        '--disable-application-cache',
                        '--disable-offline-load-stale-cache',
                        '--disable-gpu-shader-disk-cache',
                        '--media-cache-size=0',
                        '--disk-cache-size=0',

                    ],
                headless: true
        },
    });

    client.on('qr', (qr) => {
        try {
            updateQRCode(session.id, qr);
        } catch (error) {
            console.log("error update QR ", error.message);
        }
    });

    client.on('ready', async () => {
        if (!clients[session.id].scheduleIntervalId) {
            console.log(`Client ID ${session.id} is ready!`);
            const phoneNumber = client?.info?.wid?.user;

            if (phoneNumber) {
                try {
                    await updateClientConnected(session.id, phoneNumber);
                } catch (error) {
                    console.log("error update client connection ", error.message);
                }
            }

            scheduleIntervalId = setInterval(async () => {
                try {
                    await sendScheduledMessages(client, session);
                } catch (error) {
                    console.log("error send schedule message", error);
                }
            }, process.env.SCHEDULE_INTERVAL);

            clients[session.id].scheduleIntervalId = scheduleIntervalId;

            console.log(`Client ID ${session.id} success create interval with id ${scheduleIntervalId}.`);
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

        if (clients[session.id]?.scheduleIntervalId) {
            clearInterval(clients[session.id].scheduleIntervalId);
            console.log(`Interval for Client ID ${session.id} cleared.`);
        }

        clients[session.id].destroy(); 
        delete clients[session.id];
    });

    client.on('message_create', async message => {
        const isFromMe = message.fromMe;
    
        if (isFromMe) {
            if (await isUserActive(session.user_id)) {
                const phoneNumber = isFromMe ? message.to.split('@')[0] : message.from.split('@')[0];
                const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);

                if (chatbotSchedule) {
                    const customer = await fetchCustomerByUserIdAndPhoneNumber(session.user_id, phoneNumber);
                    if (customer && chatbotSchedule.chatbot_repeat === session.id) {
                        await checkTriggerOrder(message, customer, chatbotSchedule);
                        await checkTriggerResi(message, customer, chatbotSchedule);
                    } else if (!customer && chatbotSchedule.chatbot_closing === session.id) {
                        await addCustomerIfNotExists(session, message, chatbotSchedule);
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
                try {
                    await updateNoMatchNumber(session.id);
                } catch (error) {
                    console.log("error no match number ", error.message);
                }

                if (clients[session.id]?.scheduleIntervalId) {
                    clearInterval(clients[session.id].scheduleIntervalId);
                    console.log(`Interval for Client ID ${session.id} cleared.`);
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

                if (clients[session.id]?.scheduleIntervalId) {
                    clearInterval(clients[session.id].scheduleIntervalId);
                    console.log(`Interval for Client ID ${session.id} cleared.`);
                }

                clients[session.id].destroy(); 
                delete clients[session.id];
            }
        }
    }

    for (const clientId in clients) {
        if (!activeClientIds.includes(Number(clientId))) {
            console.log(`Deleting session for client ID ${clientId} as it has been deleted.`);

            if (clients[clientId]?.scheduleIntervalId) {
                clearInterval(clients[clientId].scheduleIntervalId);
                console.log(`Interval for Client ID ${clientId} cleared.`);
            }
            
            clients[clientId].destroy(); 
            delete clients[clientId];
        }
    }
}

resetClientData().then(() => {
    setInterval(initializeUnconnectedClients, process.env.CEK_CLIENT_INTERAVAL);
}).catch(err => {
    console.error('Failed to reset client data:', err);
});
