const { 
    fetchChatbotScheduleByUserId, 
    createCustomer,
    updateCustomerOrder, 
    updateCustomerResi,
} = require('./dbService');

function getValueAfterString(str1, str2) {
    const startPos = str1.indexOf(str2);
    
    if (startPos !== -1) {
        const valueStartPos = startPos + str2.length;
        const value = str1.substring(valueStartPos).trimStart().split('\n')[0];
        return value;
    }
    
    return null;
}

async function addCustomerIfNotExists(session, message) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);
    const isFromMe = message.fromMe;
    const phoneNumber = message.to.split('@')[0];
    if (chatbotSchedule.trigger_new_customer) {
        const triggerNewCustomer = chatbotSchedule.trigger_new_customer.replace(/\r/g, "");
    
        if (chatbotSchedule && 
            chatbotSchedule.chatbot_closing === session.id && 
            message.body.includes(triggerNewCustomer) &&
            isFromMe
            ) {
            await createCustomer(session.user_id, phoneNumber, "user " + phoneNumber);
        }
    }
}

async function checkTriggerOrder(session, message, customer) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);
    const isFromMe = message.fromMe;

    if (chatbotSchedule.trigger_order) {
        const triggerOrder = chatbotSchedule.trigger_order.replace(/\r/g, "");

        let ageMatch = null;
        let addressMatch = null;
        let totalOrderMatch = null;

        if (chatbotSchedule.age_pattern) {
            ageMatch = getValueAfterString(message.body, chatbotSchedule.age_pattern);
        }

        if (chatbotSchedule.address_pattern) {
            addressMatch = getValueAfterString(message.body, chatbotSchedule.address_pattern);
        }

        if (chatbotSchedule.total_order_pattern) {
            totalOrderMatch = getValueAfterString(message.body, chatbotSchedule.total_order_pattern);

            if (totalOrderMatch) {
                totalOrderMatch = parseInt(totalOrderMatch.replace(/[^0-9]+/g, ''), 10);
            }
        }

        if (chatbotSchedule && 
            chatbotSchedule.chatbot_repeat === session.id && 
            message.body.includes(triggerOrder) &&
            isFromMe
            ) {
            await updateCustomerOrder(customer, ageMatch, addressMatch, totalOrderMatch);
        }
    }
}

async function checkTriggerResi(session, message, customer) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);
    const isFromMe = message.fromMe;

    if (chatbotSchedule.trigger_update_awb) {
        const triggerUpdateAWB = chatbotSchedule.trigger_update_awb.replace(/\r/g, "");

        let awbMatch = null;
        let logisticMatch = null;

        if (chatbotSchedule.awb_pattern) {
            awbMatch = getValueAfterString(message.body, chatbotSchedule.awb_pattern);
        }

        if (chatbotSchedule.logistic_pattern) {
            logisticMatch = getValueAfterString(message.body, chatbotSchedule.logistic_pattern);
        }

        if (chatbotSchedule && 
            chatbotSchedule.chatbot_repeat === session.id && 
            message.body.includes(triggerUpdateAWB) &&
            isFromMe
            ) {
            await updateCustomerResi(customer, awbMatch, logisticMatch);
        }
    }
}

module.exports = { 
    addCustomerIfNotExists,
    checkTriggerOrder,
    checkTriggerResi,
};