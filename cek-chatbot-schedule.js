const { fetchChatbotSchedulesByUserId, updateCustomer, fetchCustomerByPhoneNumber } = require('./dbService');

async function checkChatbotSchedule(session, message) {
    const chatbotSchedules = await fetchChatbotSchedulesByUserId(session.user_id);

    for (const chatbotSchedule of chatbotSchedules) {
        const isFromMe = message.fromMe;

        if ((chatbotSchedule.trigger_from === 0 && isFromMe) || (chatbotSchedule.trigger_from === 1 && !isFromMe)) {
            if (message.body.includes(chatbotSchedule.trigger_message)) {
                const phoneNumber = isFromMe ? message.to.split('@')[0] : message.from.split('@')[0];
                const sendAfter = new Date(Date.now() + chatbotSchedule.send_after * 1000);
                const customer = await fetchCustomerByPhoneNumber(session.user_id, phoneNumber);

                if (customer) {
                    await updateCustomer(session.user_id, phoneNumber, chatbotSchedule.id, sendAfter);
                    console.log(`Schedule telah diperbaharui untuk customer dengan nomor whatsapp ${phoneNumber}`);
                } else {
                    console.log('Customer tidak ditemukan untuk nomor WhatsApp ini');
                }
            }
        }
    }
}

module.exports = {
    checkChatbotSchedule
};
