const { fetchChatbotScheduleByUserId, createCustomer } = require('./dbService');

async function addCustomerIfNotExists(session, message) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);
    const isFromMe = message.fromMe;
    const phoneNumber = message.to.split('@')[0];

    if (chatbotSchedule && 
        chatbotSchedule.chatbot_closing === session.id && 
        message.body.includes(chatbotSchedule.trigger_new_customer) &&
        isFromMe
        ) {
        try {
            await createCustomer(session.user_id, phoneNumber, "user " + phoneNumber);
        } catch (error) {
            console.log("error create customer ", error.message);
        }
    }
}

module.exports = { addCustomerIfNotExists };