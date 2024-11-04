const { Client, NoAuth } = require('whatsapp-web.js');
const { Builder, Browser, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let isChecking = false;

const isNumericString = (str) => {
    const parts = str.split("\n");
    return parts.every(part => /^\d+$/.test(part));
};

const client = new Client({
    authStrategy: new NoAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`Client is ready!`);
});

client.on('authenticated', () => {
    console.log(`Client authenticated successfully.`);
});

client.on('auth_failure', () => {
    console.error(`Authentication failed.`);
});

client.on('disconnected', (reason) => {
    console.log(`Client disconnected: ${reason}`);
});

client.on('message_create', async (message) => {
    if (!message.fromMe) {
        if (isNumericString(message.body) && !isChecking) {
            isChecking = true;
            client.sendMessage(message.from, "data sedang diproses");

            const cekResi = async () => {
                let options = new chrome.Options();
                options.addArguments('--headless'); 

                let driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
                
                try {
                    await driver.get('https://www.jne.co.id/tracking-package');
                    driver.wait(() => {
                        return driver.executeScript('return document.readyState').then((readyState) => {
                            return readyState === 'complete';
                        });
                    });

                    const inputField = await driver.findElement(By.className('tagify__input'));
                    const messageArray = message.body.split("\n");

                    if (messageArray.length > 0) {
                        for (const message of messageArray) {
                            await inputField.sendKeys(message);
                            await inputField.sendKeys(Key.TAB);  
                        }

                        await driver.sleep(1000);

                        const submitButton = await driver.findElement(By.id('lacak-pengiriman'));
                        await driver.executeScript("arguments[0].click();", submitButton);

                        await driver.sleep(1000);

                        const tableElement = await driver.findElement(By.css('.wrap-table table tbody'));
                        const rows = await tableElement.findElements(By.css('tr'));

                        let results = [];

                        for (const row of rows) {
                            const columns = await row.findElements(By.css('td'));

                            if (columns.length > 8) {
                                const noResi = await columns[1].getText();
                                const status = await columns[7].getText();

                                if (status === "ON PROCESS") {
                                    const linkRedirect = await columns[8].findElement(By.css('a'));
                                    await driver.executeScript("arguments[0].click();", linkRedirect);

                                    await driver.sleep(1000);

                                    driver.wait(() => {
                                        return driver.executeScript('return document.readyState').then((readyState) => {
                                            return readyState === 'complete';
                                        });
                                    });

                                    const windowHandles = await driver.getAllWindowHandles();
                                    if (windowHandles.length > 0) {
                                        await driver.switchTo().window(windowHandles[1]);
                                        await driver.sleep(1000); 

                                        const timeline = await driver.findElement(By.css('ul.timeline.widget'));
                                        const timelineItems = await timeline.findElements(By.css('li'));

                                        let lastValidItem = "";
                                        for (let i = timelineItems.length - 1; i >= 0; i--) {
                                            const text = await timelineItems[i].getText();
                                            if (text.trim() !== "") {
                                                lastValidItem = text;
                                                break;
                                            }
                                        }

                                        await driver.close();
                                        await driver.switchTo().window(windowHandles[0]);

                                        results.push(`Resi: ${noResi}, Status: ${lastValidItem}`);
                                    } else {
                                        results.push(`Resi: ${noResi}, Status: ${status}`);
                                    }
                                } else {
                                    results.push(`Resi: ${noResi}, Status: ${status}`);
                                }
                            } else {
                                const noResi = await columns[1].getText();
                                results.push(`Resi: ${noResi}, Status: Data tidak ditemukan`);
                            }
                        }

                        client.sendMessage(message.from, results.length > 0 ? results.join("\n") : "invalid");
                    }
                } catch (error) {
                    client.sendMessage(message.from, "error gateway");
                } finally {
                    isChecking = false;
                    await driver.quit();
                }
            };

            cekResi();
        } else if (isChecking) {
            client.sendMessage(message.from, "sistem sedang memproses resi lain");
        } else {
            client.sendMessage(message.from, "resi tidak valid");
        }
    }
});

client.initialize();
