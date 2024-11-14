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

module.exports = {
    fetchUnconnectedClients,
    resetClientData,
    updateQRCode,
    updateNoMatchNumber,
    updateClientConnected,
    fetchCustomersByUserId,
    fetchCustomerAddersByUserId,
    isUserActive
};
