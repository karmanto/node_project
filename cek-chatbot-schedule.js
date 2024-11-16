const { fetchChatbotSchedulesByUserId, updateCustomer } = require('./dbService');

async function checkChatbotSchedule(session, message) {
    const chatbotSchedules = await fetchChatbotSchedulesByUserId(session.user_id);

    for (const chatbotSchedule of chatbotSchedules) {
        const isFromMe = message.fromMe;
        const phoneNumber = isFromMe ? message.to.split('@')[0] : message.from.split('@')[0];

        if ((chatbotSchedule.trigger_from === 0 && isFromMe) || (chatbotSchedule.trigger_from === 1 && !isFromMe)) {
            if (message.body.includes(chatbotSchedule.trigger_message)) {
                const sendAfter = new Date(Date.now() + chatbotSchedule.send_after * 1000);
                await updateCustomer(session.user_id, phoneNumber, chatbotSchedule.id, sendAfter);
                console.log(`Schedule telah diperbaharui untuk customer dengan nomor whatsapp ${phoneNumber}`);
            }
        }
    }
}

module.exports = {
    checkChatbotSchedule
};
