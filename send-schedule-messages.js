require('dotenv').config();
const { MessageMedia } = require('whatsapp-web.js');
const {
    fetchChatbotScheduleByUserId, 
    fetchCustomerByUserIdAndIsActive,
    fetchEventsOrdersAwbsByCustomerIds,
    fetchDocumentsByChatbotScheduleId,
    createScheduleDone,
} = require('./dbService');
const {
    iterationEvents,
    sendingDate,
} = require('./helpers/util');

function createDefaultSaveEventData() {
    return {
        orderId: null,
        customerId: null,
        status: null,
        orderStatus: null,
        isCustomerActive: null,
    };
}

async function handleCustomerFollowUps(client, customer, schedule, documents, session) {
    const resultItrEvents = iterationEvents(customer.events);

    const followUps = [
        { fuType: 'fu3', delayDays: 3, eventCondition: 'new customer' },
        { fuType: 'fu7', delayDays: 7, eventCondition: 'fu3 new customer' },
        { fuType: 'fu14', delayDays: 14, eventCondition: 'fu7 new customer' },
        { fuType: 'fu21', delayDays: 21, eventCondition: 'fu14 new customer' },
        { fuType: 'fu25', delayDays: 25, eventCondition: 'fu21 new customer' },
    ];

    if (session.id === schedule.chatbot_closing && resultItrEvents.eventTemp === "new customer") {
        for (const { fuType, delayDays, eventCondition } of followUps) {
            if (resultItrEvents.lastEvent === eventCondition) {
                const message = schedule[`message_${fuType}`];
                const documentType = `${fuType}_doc`;
                const sendDate = sendingDate(schedule.gmt_time_sending, schedule.time_sending, resultItrEvents.newCustomerDate, delayDays);

                if (sendDate && message) {
                    const document = documents.find(doc => doc.type === documentType);
                    const numberDetails = await client.getNumberId(customer.whatsapp_number);

                    if (numberDetails) {
                        const media = document
                            ? MessageMedia.fromFilePath(process.env.LARAVEL_STORAGE_PATH + document.filepath)
                            : null;

                        await client.sendMessage(
                            numberDetails._serialized,
                            message,
                            media ? { media } : {}
                        );

                        const saveEventData = createDefaultSaveEventData();
                        saveEventData.customerId = customer.id;
                        saveEventData.status = `${fuType} new customer`;
                        if (fuType === 'fu25') saveEventData.isCustomerActive = true;

                        await createScheduleDone(saveEventData);

                        break; 
                    }
                }
            }
        }
    }
}

async function sendScheduledMessages(client, session) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);

    if (chatbotSchedule && (session.id === chatbotSchedule.chatbot_closing || session.id === chatbotSchedule.chatbot_repeat)) {
        const customers = await fetchCustomerByUserIdAndIsActive(session.user_id);

        if (customers.length > 0) {
            const customerIds = customers.map(customer => customer.id);
            const events = await fetchEventsOrdersAwbsByCustomerIds(customerIds);
            const documents = await fetchDocumentsByChatbotScheduleId(chatbotSchedule.id);

            const eventsByCustomerId = events.reduce((acc, event) => {
                if (!acc[event.customer_id]) acc[event.customer_id] = [];
                acc[event.customer_id].push(event);
                return acc;
            }, {});

            for (const customer of customers) {
                customer.events = eventsByCustomerId[customer.id] || [];
                await handleCustomerFollowUps(client, customer, chatbotSchedule, documents, session);
            }
        }
    }
}

module.exports = { sendScheduledMessages };
