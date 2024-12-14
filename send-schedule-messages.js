const {
    fetchChatbotScheduleByUserId, 
    fetchCustomerByUserIdAndIsActive,
    fetchEventsOrdersAwbsByCustomerIds,
    fetchDocumentsByChatbotScheduleId,
} = require('./dbService');
const {
    handleCustomerFollowUps
} = require('./helpers/util');

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
