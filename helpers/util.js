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
        newCustomerDate: null,
        closingDate: null,
        repeatDate: null,
        awbNumber: null,
        lastEvent: null
    };

    const transitions = {
        "new customer": {
            condition: (event) => event.status === "new customer" && result.eventTemp === "",
            action: (event) => {
                result.eventTemp = "new customer";
                result.newCustomerDate = event.created_at;
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
            condition: (event) => event.status === "delivered" && result.eventTemp === "awb release new customer",
            action: (event) => {
                result.eventTemp = "closing";
                result.closingDate = event.created_at;
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
            condition: (event) => event.status === "delivered" && result.eventTemp === "awb release after closing",
            action: (event) => {
                result.eventTemp = "repeat";
                result.repeatDate = event.created_at;
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
                result.repeatDate = event.created_at;
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

        result.lastEvent = event.status;
    }

    return result;
}

function sendingDate(gmtTime, sendingTime, dateTime, addDate) {
    const date = new Date(dateTime);
    const offsetInMinutes = (gmtTime || 0) * 60; 

    date.setMinutes(date.getMinutes() + offsetInMinutes);
    date.setDate(date.getDate() + addDate);

    if (sendingTime) {
        date.setHours(sendingTime);
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

module.exports = {
    getValueAfterString,
    handleCustomerFollowUps,
};
