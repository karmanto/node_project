require('dotenv').config();
const mysql = require('mysql2/promise');
const { initDB } = require('./config');

//fetch
async function fetchUnconnectedClients() {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM chatbot_whatsapps WHERE deleted_at IS NULL'
    );
    connection.end();
    return rows;
}

async function isUserActive(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT is_active FROM users WHERE id = ? AND deleted_at IS NULL',
        [userId]
    );
    connection.end();
    
    return rows.length > 0 && rows[0].is_active === 1;
}

async function fetchCustomerByUserIdAndIsActive(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM customers WHERE user_id = ? AND is_exception = 0 AND is_active = 1 AND deleted_at IS NULL',
        [userId]
    );
    connection.end();
    return rows;
}

async function fetchEventsByCustomerIds(customerIds) {
    if (customerIds.length === 0) {
        return [];
    }

    const connection = await initDB();
    const [rows] = await connection.execute(
        `SELECT * FROM events WHERE customer_id IN (${customerIds.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY id ASC`,
        customerIds
    );
    connection.end();
    return rows;
}

async function fetchLastEventByCustomerId(customerId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        `
        SELECT 
            events.*,
            orders.status AS order_status,
            orders.from AS order_from
        FROM events
        LEFT JOIN orders ON events.order_id = orders.id AND orders.deleted_at IS NULL
        WHERE events.customer_id = ? AND events.deleted_at IS NULL
        ORDER BY events.id DESC
        LIMIT 1
        `,
        [customerId]
    );

    connection.end();
    return rows.length > 0 ? rows[0] : null;
}

async function fetchCustomerByUserIdAndPhoneNumber(userId, phoneNumber) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM customers WHERE user_id = ? AND whatsapp_number = ? AND is_exception = 0 AND deleted_at IS NULL',
        [userId, phoneNumber]
    );
    connection.end();
    return rows.length > 0 ? rows[0] : null;
}

async function fetchChatbotScheduleByUserId(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM chatbot_schedules WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
    );
    connection.end();
    return rows.length > 0 ? rows[0] : null;
}

async function fetchAwbsByLogistic(logisticName) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        `
            SELECT awbs.* 
            FROM awbs 
            INNER JOIN logistics ON awbs.logistic_id = logistics.id 
            WHERE logistics.name = ? 
              AND awbs.deleted_at IS NULL
              AND awbs.has_closed = 0
        `,
        [logisticName]
    );
    connection.end();
    return rows;
}

async function fetchNotifierDocuments(notifierId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM documents WHERE awb_notifier_id = ? AND deleted_at IS NULL',
        [notifierId]
    );
    connection.end();
    return rows;
}

async function fetchAwbsByUserId(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        `
        SELECT 
            awbs.*,
            customers.whatsapp_number
        FROM awbs
        INNER JOIN customers ON awbs.customer_id = customers.id
        WHERE customers.user_id = ? AND awbs.deleted_at IS NULL AND customers.deleted_at IS NULL
        `,
        [userId]
    );
    connection.end();
    return rows;
}

async function fetchAwbNotifiersByUserId(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM awb_notifiers WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
    );
    connection.end();
    return rows;
}

//update
async function resetClientData() {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = NULL, whatsapp_number_linked = NULL, is_connect = 0 WHERE deleted_at IS NULL'
    );
    connection.end();
}

async function updateQRCode(clientId, qrCode) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = ?, whatsapp_number_linked = NULL, is_connect = 0 WHERE id = ? AND deleted_at IS NULL',
        [qrCode, clientId]
    );
    connection.end();
}

async function updateNoMatchNumber(clientId) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = NULL, whatsapp_number_linked = NULL, is_connect = 0 WHERE id = ? AND deleted_at IS NULL',
        [clientId]
    );
    connection.end();
}

async function updateClientConnected(clientId, whatsappNumber) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE chatbot_whatsapps SET qrcode = NULL, is_connect = 1, whatsapp_number_linked = ? WHERE id = ? AND deleted_at IS NULL',
        [whatsappNumber, clientId]
    );
    connection.end();
}

async function fetchCustomersByUserId(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM customers WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
    );
    connection.end();
    return rows;
}

async function updateCustomer(userId, phoneNumber, chatbotScheduleId, scheduleSendAfter) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE customers SET chatbot_schedule_id = ?, schedule_send_after = ? WHERE user_id = ? AND whatsapp_number = ? AND deleted_at IS NULL',
        [chatbotScheduleId, scheduleSendAfter, userId, phoneNumber]
    );
    connection.end();
}

async function updateAwbStatus(noResi, status, date) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE awbs SET last_awb_status = ?, last_awb_status_date = ?, updated_at = NOW() WHERE awb_number = ? AND deleted_at IS NULL',
        [status, date, noResi]
    );
    connection.end();
}

async function markNotifierFromAwb(awbId, notifierId) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE awbs SET awb_notifier_status_id = ? WHERE id = ? AND deleted_at IS NULL',
        [notifierId, awbId]
    );
    connection.end();
}

//create
//

//transaction
async function createCustomer(userId, whatsappNumber, name) {
    const connection = await initDB();

    await connection.beginTransaction();

    try {
        const [customerResult] = await connection.execute(
            'INSERT INTO customers (user_id, whatsapp_number, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())',
            [userId, whatsappNumber, name]
        );

        const customerId = customerResult.insertId;

        await connection.execute(
            'INSERT INTO events (customer_id, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
            [customerId, "new customer"]
        );

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.log("error create customer ", error.message);
    } finally {
        connection.end();
    }
}

async function updateCustomerOrder(customer, nameMatch, ageMatch, addressMatch, totalOrderMatch) {
    const connection = await initDB();

    await connection.beginTransaction();

    try {
        const [orderResult] = await connection.execute(
            'INSERT INTO orders (customer_id, `from`, total_order, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [customer.id, "whatsapp", totalOrderMatch]
        );

        const orderId = orderResult.insertId;

        await connection.execute(
            'INSERT INTO events (order_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [orderId, customer.id, "order"]
        );

        await connection.execute(
            `
            UPDATE customers 
            SET name = ?, age = ?, address = ?, is_active = 1
            WHERE id = ? AND deleted_at IS NULL
            `,
            [nameMatch, ageMatch, addressMatch, customer.id]
        );

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.log("error update order customer ", error.message);
    } finally {
        connection.end();
    }
}

async function updateCustomerResi(customer, awbMatch, logisticMatch, lastEvent) {
    const connection = await initDB();

    await connection.beginTransaction();

    try {
        const [logistics] = await connection.execute(
            'SELECT id FROM logistics WHERE name = ? AND deleted_at IS NULL',
            [logisticMatch]
        );

        if (logistics.length === 0) {
            throw new Error(`No logistic found with the name: ${logisticMatch}`);
        }

        const logisticId = logistics[0].id;
        
        const [awbResult] = await connection.execute(
            `
            INSERT INTO awbs (customer_id, awb_number, logistic_id, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
            `,
            [customer.id, awbMatch, logisticId]
        );

        const awbId = awbResult.insertId;

        await connection.execute(
            `
            UPDATE orders 
            SET awb_id = ?
            WHERE id = ? AND deleted_at IS NULL
            `,
            [awbId, lastEvent.order_id]
        );

        await connection.execute(
            'INSERT INTO events (order_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [lastEvent.order_id, customer.id, "awb release"]
        );

        await connection.execute(
            `
            UPDATE customers 
            SET is_active = 1
            WHERE id = ? AND deleted_at IS NULL
            `,
            [customer.id]
        );

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.log("error update resi customer ", error.message);
    } finally {
        connection.end();
    }
}

module.exports = {
    fetchUnconnectedClients,
    resetClientData,
    updateQRCode,
    updateNoMatchNumber,
    updateClientConnected,
    fetchCustomersByUserId,
    createCustomer,
    isUserActive,
    fetchCustomerByUserIdAndIsActive,
    fetchEventsByCustomerIds,
    fetchCustomerByUserIdAndPhoneNumber,
    fetchChatbotScheduleByUserId,
    updateCustomer,
    fetchAwbsByLogistic,
    updateAwbStatus,
    fetchAwbsByUserId,
    fetchAwbNotifiersByUserId,
    fetchNotifierDocuments,
    markNotifierFromAwb,
    updateCustomerOrder,
    updateCustomerResi,
    fetchLastEventByCustomerId,
};
