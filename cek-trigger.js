const { 
    createCustomer,
    updateCustomerOrder, 
    updateCustomerResi,
    fetchLastEventByCustomerId,
} = require('./dbService');
const {
    getValueAfterString,
} = require('./helpers/util');

async function addCustomerIfNotExists(session, message, chatbotSchedule) {
    const phoneNumber = message.to.split('@')[0];

    if (chatbotSchedule.trigger_new_customer) {
        const triggerNewCustomer = chatbotSchedule.trigger_new_customer.replace(/\r/g, "");
    
        if (message.body.includes(triggerNewCustomer)) 
        {
            await createCustomer(session.user_id, phoneNumber, "user " + phoneNumber);
        }
    }
}

async function checkTriggerOrder(message, customer, chatbotSchedule) {
    const lastEvent = await fetchLastEventByCustomerId(customer.id);

    if (lastEvent.status !== "order" && lastEvent.status !== "awb release" && lastEvent.status !== "delivering" && lastEvent.status !== "in kurir") {
        if (chatbotSchedule.trigger_order) {
            const triggerOrder = chatbotSchedule.trigger_order.replace(/\r/g, "");
    
            let ageMatch = null;
            let addressMatch = null;
            let totalOrderMatch = null;
            let nameMatch = null;
    
            if (chatbotSchedule.name_pattern) {
                nameMatch = getValueAfterString(message.body, chatbotSchedule.name_pattern);
            }
    
            if (chatbotSchedule.age_pattern) {
                ageMatch = getValueAfterString(message.body, chatbotSchedule.age_pattern);
    
                if (ageMatch) {
                    ageMatch = parseInt(ageMatch.replace(/[^0-9]+/g, ''), 10);
                }
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
    
            if (message.body.includes(triggerOrder)) 
            {
                await updateCustomerOrder(customer, nameMatch, ageMatch, addressMatch, totalOrderMatch);
            }
        }
    }
}

async function checkTriggerResi(message, customer, chatbotSchedule) {
    const lastEvent = await fetchLastEventByCustomerId(customer.id);

    if (lastEvent.status === "order" && lastEvent.order_id && lastEvent.order_from === "whatsapp") {
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

            if (message.body.includes(triggerUpdateAWB) ) 
            {
                await updateCustomerResi(customer, awbMatch, logisticMatch, lastEvent);
            }
        }
    }
}

module.exports = { 
    addCustomerIfNotExists,
    checkTriggerOrder,
    checkTriggerResi,
};