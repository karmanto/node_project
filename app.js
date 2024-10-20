const { Client, LocalAuth } = require('whatsapp-web.js');
const { Builder, Browser, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let clients = {};
let isChecking = false;

function isNumericString(str) {
    return /^\d+$/.test(str);
  }

function createSession(sessionId) {
    console.log(`Creating session: ${sessionId}`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: sessionId 
        })
    });

    client.on('qr', (qr) => {
        console.log(`QR code for session ${sessionId}:`);
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.log(`Client for session ${sessionId} is ready!`);
    });

    client.on('authenticated', () => {
        console.log(`Client for session ${sessionId} authenticated successfully.`);
    });

    client.on('auth_failure', () => {
        console.error(`Authentication failed for session ${sessionId}.`);
    });

    client.on('disconnected', (reason) => {
        console.log(`Client for session ${sessionId} disconnected: ${reason}`);
    });

    client.on('message_create', async message => {
        if (!message.fromMe) {
            if (isNumericString(message.body) && !isChecking) {
                isChecking = true;
                client.sendMessage(message.from, "data sedang diproses");
                (async function example() {
                    let options = new chrome.Options();
                    options.addArguments('--headless'); 
                  
                    let driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
                  
                    try {
                        await driver.get('https://www.jne.co.id/');
                        driver.wait(function() {
                            return driver.executeScript('return document.readyState').then(function(readyState) {
                                return readyState === 'complete';
                            });
                        });
                  
                        const initialUrl = await driver.getCurrentUrl();
                        client.sendMessage(message.from, "sedang membuka situs cek resi di " + initialUrl);
                        
                        const inputField = await driver.findElement(By.className('tagify__input'));
                        await inputField.sendKeys(message.body);
                        await driver.sleep(1000);
                    
                        await inputField.sendKeys(Key.TAB);  
                        await driver.sleep(1000);
                    
                        const submitButton = await driver.findElement(By.id('be-search-resi'));
                        await submitButton.click();
                        await driver.sleep(1000);
                  
                        driver.wait(function() {
                            return driver.executeScript('return document.readyState').then(function(readyState) {
                                return readyState === 'complete';
                            });
                        });

                        try {
                            const statusElement = await driver.findElement(By.css('td[data-label="Status"]'));
                            const statusText = await statusElement.getText();
                            client.sendMessage(message.from, "status resi: " + statusText);
                        } catch (error) {
                            client.sendMessage(message.from, "data tidak ditemukan");
                        }
                  
                    } finally {
                        isChecking = false;
                        await driver.quit();
                    }
                })();
            } else if (isChecking) {
                client.sendMessage(message.from, "sistem sedang memproses resi lain");
            } else {
                client.sendMessage(message.from, "resi tidak valid");
            }
        }
    });

    client.initialize();
    clients[sessionId] = client;

    return client;
}

function destroySession(sessionId) {
    const sessionPath = path.join(__dirname, `.wwebjs_auth/session-${sessionId}`);

    if (clients[sessionId]) {
        console.log(`Destroying client for session ${sessionId}`);
        
        clients[sessionId].destroy().then(() => {
            console.log(`Client for session ${sessionId} destroyed.`);
            
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`Session ${sessionId} has been destroyed from disk.`);
            } else {
                console.log(`Session ${sessionId} does not exist on disk.`);
            }

            delete clients[sessionId];
        }).catch(err => {
            console.error(`Error destroying client for session ${sessionId}:`, err);
        });
    } else {
        console.log(`Client for session ${sessionId} does not exist.`);
    }
}

const session1 = createSession('session1');

setTimeout(() => {
    // destroySession('session1');
    // destroySession('session2');
}, 60000);