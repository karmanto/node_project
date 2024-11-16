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
                const awbPattern = new RegExp(`${adder.awb_field}\\s*(\\S+)`);
                const logisticPattern = new RegExp(`${adder.logistic_field}\\s*(\\S+)`);
                const awbMatch = message.body.match(awbPattern);
                const logisticMatch = message.body.match(logisticPattern);

                if (awbMatch && logisticMatch) {
                    const awbNumber = awbMatch[1];
                    const logisticName = logisticMatch[1];
                    const logisticId = await fetchLogisticByName(logisticName);
                    
                    if (logisticId) {
                        const awbExists = await checkAwbExists(customer.id, logisticId, awbNumber);
                        if (!awbExists) {
                            await createAwb(customer.id, logisticId, awbNumber);
                            console.log(`AWB baru dibuat untuk customer ID ${customer.id} dengan nomor AWB ${awbNumber} dan logistic ${logisticName}`);
                        } else {
                            console.log('AWB sudah ada, tidak perlu membuat baru.');
                        }
                        break; 
                    } else {
                        console.log('Logistic tidak ditemukan');
                    }
                }
            }
        }
    }
}

module.exports = {
    checkAndCreateAwb
};
