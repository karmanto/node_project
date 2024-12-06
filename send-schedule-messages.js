const { MessageMedia } = require('whatsapp-web.js');
const {
    fetchChatbotScheduleByUserId, 
    fetchCustomerByUserIdAndIsActive,
    fetchEventsByCustomerIds,
    fetchAwbsByUserId,
} = require('./dbService');

const convertHourToTimeFormat = (hour) => {
    if (typeof hour !== 'number' || hour < 0 || hour > 23) {
        return `00:00:00`;
    }

    const formattedHour = hour.toString().padStart(2, '0');
    return `${formattedHour}:00:00`;
};

async function sendScheduledFollowUpMessages(client, session) {
    const chatbotSchedule = await fetchChatbotScheduleByUserId(session.user_id);

    if (session.id === chatbotSchedule.chatbot_closing || session.id === chatbotSchedule.chatbot_repeat) {
        const customers = await fetchCustomerByUserIdAndIsActive(session.user_id);

        if (customers.length > 0) {
            const gmtOffset = chatbotSchedule.gmt_time_sending || 0;
            const timeSending = convertHourToTimeFormat(chatbotSchedule.time_sending);
            const customerIds = customers.map(customer => customer.id);
            const events = await fetchEventsByCustomerIds(customerIds);
            const awbsByUser = await fetchAwbsByUserId(session.user_id);

            const eventsByCustomerId = events.reduce((acc, event) => {
                if (!acc[event.customer_id]) {
                    acc[event.customer_id] = [];
                }
                acc[event.customer_id].push(event);
                return acc;
            }, {});


            for (const customer of customers) {
                customer.events = eventsByCustomerId[customer.id] || [];

                let eventTemp = "";
                let newCustomerDate;
                let awbId;

                for (const event of customer.events) {
                    if (event.status === "new customer" && eventTemp === "") {
                        eventTemp = "new customer";
                    } else if (event.status === "order" && eventTemp === "new customer") {
                        eventTemp = "order";
                    } else if (event.status === "awb release" && eventTemp === "order") {
                        eventTemp = "awb release";
                    } else if (event.status === "delivered" && eventTemp === "awb release") {
                        eventTemp = "closing";
                    } else if (event.status === "order" && eventTemp === "closing") {
                        eventTemp = "order repeat";
                    } else if (event.status === "awb release" && eventTemp === "order repeat") {
                        eventTemp = "awb release repeat";
                    } else if (event.status === "delivered" && eventTemp === "awb release repeat") {
                        eventTemp = "repeat";
                    } else if (event.status === "order" && eventTemp === "repeat") {
                        eventTemp = "order repeat";
                    } 
                }
            }
        }
    }
}

module.exports = { sendScheduledFollowUpMessages };
