const { 
    fetchAwbAddersByUserId, 
    fetchLogisticByName, 
    createAwb, 
    checkAwbExists 
} = require('./dbService'); 

async function checkAndCreateAwb(session, message, customer) {
    const awbAdders = await fetchAwbAddersByUserId(session.user_id);

    for (const adder of awbAdders) {
        const isFromMe = message.fromMe;

        if ((adder.trigger_from === 0 && isFromMe) || (adder.trigger_from === 1 && !isFromMe)) {
            if (message.body.includes(adder.trigger_message)) {
                const awbPattern = new RegExp(`${adder.awb_field}\\s*:\\s*(\\S*)\\s*(?:\\n|$)`);
                const logisticPattern = new RegExp(`${adder.logistic_field}\\s*:\\s*(\\S*)\\s*(?:\\n|$)`);
                const awbMatch = message.body.match(awbPattern);
                const logisticMatch = message.body.match(logisticPattern);

                if (awbMatch && logisticMatch) {
                    const awbNumber = awbMatch[1] ?? "";
                    const logisticName = logisticMatch[1] ?? "";
                    const logisticId = await fetchLogisticByName(logisticName);
                    
                    if (logisticId && awbNumber && logisticName) {
                        const awbExists = await checkAwbExists(customer.id, logisticId, awbNumber);
                        if (!awbExists) {
                            try {
                                await createAwb(customer.id, logisticId, awbNumber);
                            } catch (error) {
                                console.log("error create new awb ", error.message);
                            }
                        }

                        break; 
                    } 
                }
            }
        }
    }
}

module.exports = {
    checkAndCreateAwb
};
