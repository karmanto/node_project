const { MessageMedia } = require('whatsapp-web.js');
const {
    fetchAwbsByUserId,
    fetchAwbNotifiersByUserId,
    fetchNotifierDocuments,
    markNotifierFromAwb
} = require('./dbService');

async function sendAwbNotifierMessages(client, session) {
    const awbs = await fetchAwbsByUserId(session.user_id);
    const awbNotifiers = await fetchAwbNotifiersByUserId(session.user_id);

    for (const awb of awbs) {
        for (const awb_notifier of awbNotifiers) {
            if (awb_notifier.logistic_id === awb.logistic_id && 
                awb.last_awb_status.includes(awb_notifier.trigger_awb_status) &&
                awb.awb_notifier_status_id != awb_notifier.id
                ) {
                    const documents = await fetchNotifierDocuments(awb_notifier.id);

                    for (const doc of documents) {
                        try {
                            const media = MessageMedia.fromFilePath(process.env.LARAVEL_STORAGE_PATH + doc.filepath);
                            await client.sendMessage(`${awb.whatsapp_number}@c.us`, media);
                        } catch (error) {
                            console.error(`Error sending media to ${awb.whatsapp_number}:`, error.message);
                        }
                    }
                    
                    await client.sendMessage(`${awb.whatsapp_number}@c.us`, awb_notifier.message);

                    try {
                        await markNotifierFromAwb(awb.id, awb_notifier.id);
                    } catch (error) {
                        console.error(`Error marking notifier for awb ${awb.id}:`, error.message);
                    }
                }
        }
    }
}

module.exports = { sendAwbNotifierMessages };
