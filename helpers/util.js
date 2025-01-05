require('dotenv').config();
const { MessageMedia } = require('whatsapp-web.js');
const {
    createScheduleDone,
} = require('../dbService');

function getValueAfterString(str1, str2) {
    const startPos = str1.indexOf(str2);
    
    if (startPos !== -1) {
        const valueStartPos = startPos + str2.length;
        const value = str1.substring(valueStartPos).trimStart().split('\n')[0];
        return value;
    }
    
    return null;
}

function iterationEvents(events) {
    let result = {
        eventTemp: "",
        baseDate: null,
        awbNumber: null,
        lastEvent: null
    };

    const transitions = {
        "new customer": {
            condition: (event) => event.status === "new customer" && result.eventTemp === "",
            action: (event) => {
                result.eventTemp = "new customer";
                result.baseDate = event.created_at;
            }
        },
        "order new customer": {
            condition: (event) => event.status === "order" && (result.eventTemp === "new customer" || result.eventTemp === "retur new customer"),
            action: () => {
                result.eventTemp = "order new customer";
            }
        },
        "awb release new customer": {
            condition: (event) => event.status === "awb release" && result.eventTemp === "order new customer",
            action: (event) => {
                result.eventTemp = "awb release new customer";
                result.awbNumber = event.awb_number;
            }
        },
        "closing": {
            condition: (event) => event.status === "closing" && result.eventTemp === "awb release new customer",
            action: (event) => {
                result.eventTemp = "closing";
                result.baseDate = event.created_at;
            }
        },
        "retur new customer": {
            condition: (event) => event.status === "retur" && result.eventTemp === "awb release new customer",
            action: () => {
                result.eventTemp = "retur new customer";
            }
        },
        "order after closing": {
            condition: (event) => event.status === "order" && (result.eventTemp === "closing" || result.eventTemp === "retur after closing"),
            action: () => {
                result.eventTemp = "order after closing";
            }
        },
        "awb release after closing": {
            condition: (event) => event.status === "awb release" && result.eventTemp === "order after closing",
            action: (event) => {
                result.eventTemp = "awb release after closing";
                result.awbNumber = event.awb_number;
            }
        },
        "repeat": {
            condition: (event) => event.status === "repeat" && result.eventTemp === "awb release after closing",
            action: (event) => {
                result.eventTemp = "repeat";
                result.baseDate = event.created_at;
            }
        },
        "retur after closing": {
            condition: (event) => event.status === "retur" && result.eventTemp === "awb release after closing",
            action: () => {
                result.eventTemp = "retur after closing";
            }
        },
        "order after repeat": {
            condition: (event) => event.status === "order" && (result.eventTemp === "repeat" || result.eventTemp === "retur after repeat"),
            action: () => {
                result.eventTemp = "order after repeat";
            }
        },
        "awb release after repeat": {
            condition: (event) => event.status === "awb release" && result.eventTemp === "order after repeat",
            action: (event) => {
                result.eventTemp = "awb release after repeat";
                result.awbNumber = event.awb_number;
            }
        },
        "repeat after repeat": {
            condition: (event) => event.status === "delivered" && result.eventTemp === "awb release after repeat",
            action: (event) => {
                result.eventTemp = "repeat";
                result.baseDate = event.created_at;
            }
        },
        "retur after repeat": {
            condition: (event) => event.status === "retur" && result.eventTemp === "awb release after repeat",
            action: () => {
                result.eventTemp = "retur after repeat";
            }
        }
    };

    for (const event of events) {
        for (const [key, transition] of Object.entries(transitions)) {
            if (transition.condition(event)) {
                transition.action(event);
                break;
            }
        }

        result.lastEvent = event;
    }

    return result;
}

function sendingDate(gmtTime, sendingTime, dateTime, addDate) {
    const date = new Date(dateTime);
    const offsetInMinutes = (gmtTime || 0) * 60; 

    date.setMinutes(date.getMinutes() + offsetInMinutes);
    date.setDate(date.getDate() + addDate);

    if (sendingTime) {
        date.setHours(sendingTime + 1);
        date.setMinutes(0);
        date.setSeconds(0);
    }

    const gmtResult = new Date(date.getTime() - offsetInMinutes * 60 * 1000);
    const now = new Date();
    
    return gmtResult < now;
}

function createDefaultSaveEventData() {
    return {
        orderId: null,
        customerId: null,
        awbId: null,
        status: null,
        isCustomerActive: null,
    };
}

async function handleCustomerFollowUps(client, customer, schedule, documents, session) {
    const resultItrEvents = iterationEvents(customer.events);

    const followUpTypes = {
        chatbot_new_customer: [
            { fuType: 'fu1', delayDays: 1, lastEventCondition: 'new customer', statusToSave: "fu1 new customer" },
            { fuType: 'fu2', delayDays: 2, lastEventCondition: 'fu1 new customer', statusToSave: "fu2 new customer" },
            { fuType: 'fu3', delayDays: 3, lastEventCondition: 'fu2 new customer', statusToSave: "fu3 new customer" },
            { fuType: 'fu7', delayDays: 7, lastEventCondition: 'fu3 new customer', statusToSave: "fu7 new customer" },
            { fuType: 'fu14', delayDays: 14, lastEventCondition: 'fu7 new customer', statusToSave: "fu14 new customer" },
            { fuType: 'fu21', delayDays: 21, lastEventCondition: 'fu14 new customer', statusToSave: "fu21 new customer" },
            { fuType: 'fu25', delayDays: 25, lastEventCondition: 'fu21 new customer', statusToSave: "fu25 new customer" },
        ],
        chatbot_after_closing: [
            { fuType: 'fu3ac', delayDays: 3, lastEventCondition: 'closing', statusToSave: "fu3 after closing" },
            { fuType: 'fu7ac', delayDays: 7, lastEventCondition: 'fu3 after closing', statusToSave: "fu7 after closing" },
            { fuType: 'fu14ac', delayDays: 14, lastEventCondition: 'fu7 after closing', statusToSave: "fu14 after closing" },
            { fuType: 'fu21ac', delayDays: 21, lastEventCondition: 'fu14 after closing', statusToSave: "fu21 after closing" },
            { fuType: 'fu25ac', delayDays: 25, lastEventCondition: 'fu21 after closing', statusToSave: "fu25 after closing" },
        ],
        chatbot_after_repeat: [
            { fuType: 'fu3ar', delayDays: 3, lastEventCondition: 'repeat', statusToSave: "fu3 after repeat" },
            { fuType: 'fu7ar', delayDays: 7, lastEventCondition: 'fu3 after repeat', statusToSave: "fu7 after repeat" },
            { fuType: 'fu14ar', delayDays: 14, lastEventCondition: 'fu7 after repeat', statusToSave: "fu14 after repeat" },
            { fuType: 'fu21ar', delayDays: 21, lastEventCondition: 'fu14 after repeat', statusToSave: "fu21 after repeat" },
            { fuType: 'fu25ar', delayDays: 25, lastEventCondition: 'fu21 after repeat', statusToSave: "fu25 after repeat" },
        ],
    };

    const followUps = session.id === schedule.chatbot_closing && resultItrEvents.eventTemp === "new customer"
        ? followUpTypes.chatbot_new_customer
        : session.id === schedule.chatbot_repeat && resultItrEvents.eventTemp === "closing"
            ? followUpTypes.chatbot_after_closing
            : session.id === schedule.chatbot_repeat && resultItrEvents.eventTemp === "repeat"
                ? followUpTypes.chatbot_after_repeat
                : null;

    if (followUps) {
        for (const { fuType, delayDays, lastEventCondition, statusToSave } of followUps) {
            if (resultItrEvents.lastEvent.status === lastEventCondition) {
                const message = schedule[`message_${fuType}`];
                const documentType = `${fuType}_doc`;
                const sendDate = sendingDate(schedule.gmt_time_sending, schedule.time_sending, resultItrEvents.baseDate, delayDays);
    
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
                        saveEventData.status = statusToSave;
                        if (fuType === 'fu25' || fuType === 'fu25ac' || fuType === 'fu25ar') saveEventData.isCustomerActive = false;
    
                        await createScheduleDone(saveEventData);
    
                        break; 
                    }
                }
            }
        }

        return;
    }

    if (session.id === schedule.chatbot_repeat && resultItrEvents.eventTemp.includes("awb release")) {
        if (
            resultItrEvents.lastEvent.last_awb_status === "delivering" && 
            resultItrEvents.lastEvent.status === "awb release"
        ) {
            let message = schedule.message_delivering;
            const documentType = 'delivering_doc';

            if (resultItrEvents.lastEvent.estimate_days) {
                message = message.replace("[estimate_day]", resultItrEvents.lastEvent.estimate_days);
            } 

            if (message) {
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
                }
            }

            const saveEventData = createDefaultSaveEventData();
            saveEventData.customerId = customer.id;
            saveEventData.status = "delivering";
            saveEventData.orderId = resultItrEvents.lastEvent.order_id;

            await createScheduleDone(saveEventData);
        } else if (
            resultItrEvents.lastEvent.last_awb_status === "in kurir" &&
            (
                resultItrEvents.lastEvent.status === "awb release" ||
                resultItrEvents.lastEvent.status === "delivering"
            )
        ) {
            let message = schedule.message_in_kurir;
            const documentType = 'in_kurir_doc';

            if (resultItrEvents.lastEvent.estimate_days) {
                message = message.replace("[estimate_day]", resultItrEvents.lastEvent.estimate_days);
            } 

            if (message) {
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
                }
            }

            const saveEventData = createDefaultSaveEventData();
            saveEventData.customerId = customer.id;
            saveEventData.status = "in kurir";
            saveEventData.orderId = resultItrEvents.lastEvent.order_id;

            await createScheduleDone(saveEventData);
        } else if (resultItrEvents.lastEvent.last_awb_status === "delivered" &&
            (
                resultItrEvents.lastEvent.status === "awb release" ||
                resultItrEvents.lastEvent.status === "delivering" ||
                resultItrEvents.lastEvent.status === "in kurir"
            )
        ) {
            let message = schedule.message_delivered;
            const documentType = 'delivered_doc';

            if (resultItrEvents.lastEvent.estimate_days) {
                message = message.replace("[estimate_day]", resultItrEvents.lastEvent.estimate_days);
            } 

            if (message) {
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
                }
            }

            const saveEventData = createDefaultSaveEventData();
            saveEventData.customerId = customer.id;

            if (resultItrEvents.eventTemp.replace("awb release", "").includes("new customer")) {
                saveEventData.status = "closing";
            } else if (resultItrEvents.eventTemp.replace("awb release", "").includes("after closing")) {
                saveEventData.status = "repeat";
            } else {
                saveEventData.status = "repeat";
            }

            saveEventData.orderId = resultItrEvents.lastEvent.order_id;
            saveEventData.awbId = resultItrEvents.lastEvent.awb_id;

            await createScheduleDone(saveEventData);
        } else if (resultItrEvents.lastEvent.last_awb_status === "retur" &&
            (
                resultItrEvents.lastEvent.status === "awb release" ||
                resultItrEvents.lastEvent.status === "delivering" ||
                resultItrEvents.lastEvent.status === "in kurir"
            )
        ) {
            const saveEventData = createDefaultSaveEventData();
            saveEventData.customerId = customer.id;
            saveEventData.status = "retur";
            saveEventData.orderId = resultItrEvents.lastEvent.order_id;
            saveEventData.awbId = resultItrEvents.lastEvent.awb_id;

            await createScheduleDone(saveEventData);
        }
    }
}

module.exports = {
    getValueAfterString,
    handleCustomerFollowUps,
};
