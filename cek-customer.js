const { fetchCustomersByUserId, fetchCustomerAddersByUserId, createCustomer } = require('./dbService');

async function addCustomerIfNotExists(session, message) {
    const customers = await fetchCustomersByUserId(session.user_id);
    const customerAdders = await fetchCustomerAddersByUserId(session.user_id);

    if (customerAdders.length > 0) {
        for (const adder of customerAdders) {
            const isFromMe = message.fromMe;

            if ((adder.trigger_from === 0 && isFromMe) || (adder.trigger_from === 1 && !isFromMe)) {
                if (message.body.includes(adder.trigger_message)) {
                    const phoneNumber = isFromMe ? message.to.split('@')[0] : message.from.split('@')[0];
                    const customerExists = customers.some(customer => customer.whatsapp_number === phoneNumber);

                    if (!customerExists) {
                        await createCustomer(session.user_id, session.id, phoneNumber, "user " + phoneNumber);
                        console.log(`New customer added with user ID ${session.user_id} and phone number ${phoneNumber}`);
                        break;
                    }
                }
            }
        }
    }
}

module.exports = { addCustomerIfNotExists };