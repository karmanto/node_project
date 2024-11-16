require('dotenv').config();
const mysql = require('mysql2/promise');
const { initDB } = require('./config');

async function fetchUnconnectedClients() {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM chatbot_whatsapps WHERE deleted_at IS NULL'
    );
    connection.end();
    return rows;
}

async function fetchCustomerAddersByUserId(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM customer_adders WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
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

async function fetchCustomerByPhoneNumber(userId, phoneNumber) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM customers WHERE user_id = ? AND whatsapp_number = ? AND is_exception = 0 AND deleted_at IS NULL',
        [userId, phoneNumber]
    );
    connection.end();
    return rows.length > 0 ? rows[0] : null;
}

async function fetchAwbAddersByUserId(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM awb_adders WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
    );
    connection.end();
    return rows;
}

async function fetchLogisticByName(logisticName) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT id FROM logistics WHERE name = ? AND deleted_at IS NULL',
        [logisticName]
    );
    connection.end();
    return rows.length > 0 ? rows[0].id : null;
}

async function checkAwbExists(customerId, logisticId, awbNumber) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT id FROM awbs WHERE customer_id = ? AND logistic_id = ? AND awb_number = ? AND deleted_at IS NULL',
        [customerId, logisticId, awbNumber]
    );
    connection.end();
    return rows.length > 0;
}

async function fetchChatbotSchedulesByUserId(userId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM chatbot_schedules WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
    );
    connection.end();
    return rows;
}

async function fetchAwbsByLogistic(logisticName) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        `
            SELECT awbs.* 
            FROM awbs 
            INNER JOIN logistics ON awbs.logistic_id = logistics.id 
            WHERE logistics.name = ? AND awbs.deleted_at IS NULL
        `,
        [logisticName]
    );
    connection.end();
    return rows;
}

async function fetchCustomersWithSchedule(userId) {
    const now = new Date();
    const connection = await initDB();
    const [rows] = await connection.execute(
        `SELECT * 
         FROM customers 
         WHERE user_id = ? 
           AND chatbot_schedule_id IS NOT NULL 
           AND schedule_send_after < ?
           AND deleted_at IS NULL`,
        [userId, now]
    );
    connection.end();
    return rows;
}

async function fetchChatbotScheduleById(id) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM chatbot_schedules WHERE id = ? AND deleted_at IS NULL',
        [id]
    );
    connection.end();
    return rows.length > 0 ? rows[0] : null;
}

async function fetchChatbotDocuments(scheduleId) {
    const connection = await initDB();
    const [rows] = await connection.execute(
        'SELECT * FROM documents WHERE chatbot_schedule_id = ? AND deleted_at IS NULL',
        [scheduleId]
    );
    connection.end();
    return rows;
}

//////////
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

async function markCustomerRemoveScheduled(id) {
    const connection = await initDB();
    await connection.execute(
        'UPDATE customers SET chatbot_schedule_id = NULL, schedule_send_after = NULL WHERE id = ? AND deleted_at IS NULL',
        [id]
    );
    connection.end();
}

//////////
async function createCustomer(userId, chatbotWhatsappId, whatsappNumber, name) {
    const connection = await initDB();
    await connection.execute(
        'INSERT INTO customers (user_id, chatbot_whatsapp_id, whatsapp_number, name, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
        [userId, chatbotWhatsappId, whatsappNumber, name]
    );
    connection.end();
}

async function createAwb(customerId, logisticId, awbNumber) {
    const connection = await initDB();
    await connection.execute(
        'INSERT INTO awbs (customer_id, logistic_id, awb_number, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [customerId, logisticId, awbNumber]
    );
    connection.end();
}

module.exports = {
    fetchUnconnectedClients,
    resetClientData,
    updateQRCode,
    updateNoMatchNumber,
    updateClientConnected,
    fetchCustomersByUserId,
    fetchCustomerAddersByUserId,
    createCustomer,
    isUserActive,
    fetchCustomerByPhoneNumber,
    fetchAwbAddersByUserId,
    fetchLogisticByName,
    createAwb,
    checkAwbExists,
    fetchChatbotSchedulesByUserId,
    updateCustomer,
    fetchAwbsByLogistic,
    updateAwbStatus,
    fetchCustomersWithSchedule,
    fetchChatbotScheduleById,
    fetchChatbotDocuments,
    markCustomerRemoveScheduled
};
