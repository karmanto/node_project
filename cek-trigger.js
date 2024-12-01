const { 
    fetchChatbotScheduleByUserId, 
    createCustomer,
    updateCustomerOrder, 
    updateCustomerResi,
} = require('./dbService');

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

async function checkTriggerOrder(session, message, customer) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);
    const isFromMe = message.fromMe;

    let ageMatch = null;
    let addressMatch = null;
    let totalOrderMatch = null;

    if (chatbotSchedule.age_pattern) {
        const agePattern = new RegExp(`${chatbotSchedule.age_pattern}\\s*:\\s*(\\S*)\\s*(?:\\n|$)`);
        ageMatch = message.body.match(agePattern);
    }

    if (chatbotSchedule.address_pattern) {
        const addressPattern = new RegExp(`${chatbotSchedule.address_pattern}\\s*:\\s*(\\S*)\\s*(?:\\n|$)`);
        addressMatch = message.body.match(addressPattern);
    }

    if (chatbotSchedule.total_order_pattern) {
        const totalOrderPattern = new RegExp(`${chatbotSchedule.total_order_pattern}\\s*:\\s*(\\S*)\\s*(?:\\n|$)`);
        totalOrderMatch = message.body.match(totalOrderPattern);
    }

    if (chatbotSchedule && 
        chatbotSchedule.chatbot_repeat === session.id && 
        message.body.includes(chatbotSchedule.trigger_order) &&
        isFromMe
        ) {
        try {
            await updateCustomerOrder(customer, ageMatch, addressMatch, totalOrderMatch);
        } catch (error) {
            console.log("error update trigger order customer ", error.message);
        }
    }
}

async function checkTriggerResi(session, message, customer) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);
    const isFromMe = message.fromMe;

    let awbMatch = null;
    let logisticMatch = null;

    if (chatbotSchedule.awb_pattern) {
        const awbPattern = new RegExp(`${chatbotSchedule.awb_pattern}\\s*:\\s*(\\S*)\\s*(?:\\n|$)`);
        awbMatch = message.body.match(awbPattern);
    }

    if (chatbotSchedule.logistic_pattern) {
        const logisticPattern = new RegExp(`${chatbotSchedule.logistic_pattern}\\s*:\\s*(\\S*)\\s*(?:\\n|$)`);
        logisticMatch = message.body.match(logisticPattern);
    }

    if (chatbotSchedule && 
        chatbotSchedule.chatbot_repeat === session.id && 
        message.body.includes(chatbotSchedule.trigger_update_awb) &&
        isFromMe
        ) {
        try {
            await updateCustomerResi(customer, awbMatch, logisticMatch);
        } catch (error) {
            console.log("error update trigger order customer ", error.message);
        }
    }
}

module.exports = { 
    addCustomerIfNotExists,
    checkTriggerOrder,
    checkTriggerResi,
};