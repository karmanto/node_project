const { MessageMedia } = require('whatsapp-web.js');
const {
    fetchCustomersWithSchedule,
    fetchChatbotDocuments,
    markCustomerRemoveScheduled
} = require('./dbService');

async function sendScheduledMessages(client, session) {
    const customers = await fetchCustomersWithSchedule(session.user_id);

    for (const customer of customers) {
        const message = customer.message;
        const documents = await fetchChatbotDocuments(customer.chatbot_schedule_id);

        for (const doc of documents) {
            try {
                const media = MessageMedia.fromFilePath(process.env.LARAVEL_STORAGE_PATH + doc.filepath);
                await client.sendMessage(`${customer.whatsapp_number}@c.us`, media);
            } catch (error) {
                console.error(`Error sending media to ${customer.whatsapp_number}:`, error.message);
            }
        }

        await client.sendMessage(`${customer.whatsapp_number}@c.us`, message);

        try {
            await markCustomerRemoveScheduled(customer);
        } catch (error) {
            console.error(`Error removing schedule for customer ${customer.id}:`, error.message);
        }
    }
}

module.exports = { sendScheduledMessages };
