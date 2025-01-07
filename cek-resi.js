require('dotenv').config();
const { Builder, Browser, By, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { fetchAwbsByLogistic, updateAwbStatus } = require('./dbService');

const chunkArray = (array, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
};

const cekResiJne = async () => {
    let options = new chrome.Options();
    options.addArguments(
        '--headless');

    let driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();

    try {
        const awbs = await fetchAwbsByLogistic('JNE');

        if (awbs.length === 0) {
            return { status: 'success', message: 'Tidak ada data AWB untuk JNE.' };
        }

        const awbChunks = chunkArray(awbs, 100);

        for (const chunk of awbChunks) {
            await driver.get('https://www.jne.co.id/tracking-package');
            await driver.wait(() => {
                return driver.executeScript('return document.readyState').then((readyState) => {
                    return readyState === 'complete';
                });
            });

            const inputField = await driver.findElement(By.className('tagify__input'));

            for (const awb of chunk) {
                await inputField.sendKeys(awb.awb_number);
                await inputField.sendKeys(Key.TAB);
            }

            await driver.sleep(1000);

            const submitButton = await driver.findElement(By.id('lacak-pengiriman'));
            await driver.executeScript("arguments[0].click();", submitButton);

            await driver.sleep(1000);

            const tableElement = await driver.findElement(By.css('.wrap-table table tbody'));
            const rows = await tableElement.findElements(By.css('tr'));

            for (const row of rows) {
                const columns = await row.findElements(By.css('td'));
                const noResi = await columns[1].getText();

                if (columns.length > 8) {
                    const linkRedirect = await columns[8].findElement(By.css('a'));
                    await driver.executeScript("arguments[0].click();", linkRedirect);

                    await driver.sleep(1000);

                    await driver.wait(() => {
                        return driver.executeScript('return document.readyState').then((readyState) => {
                            return readyState === 'complete';
                        });
                    });

                    const windowHandles = await driver.getAllWindowHandles();
                    if (windowHandles.length > 0) {
                        await driver.switchTo().window(windowHandles[1]);
                        await driver.sleep(1000);

                        const timelineElement = await driver.findElement(By.css('ul.timeline.widget'));
                        const timelineItemsElement = await timelineElement.findElements(By.css('li'));
                        const destinationElement = await driver.findElement(By.css('.tile_stats_count:nth-child(3) h4'));
                        const destinationValue = await destinationElement.getText();

                        const estimateDaysElement = await driver.findElement(By.css('.tile_stats_count:nth-child(4) h3'));
                        const estimatedaysValue = await estimateDaysElement.getText();
                        const estimatedDays = estimatedaysValue.match(/\d+/)[0];

                        let lastValidStatus = null;
                        let lastValidStatusDate = null;
                        let shipmentReceivedDate = null;
                        let consoleStatus = false;

                        for (let i = 0; i < timelineItemsElement.length; i++) {
                            const text = await timelineItemsElement[i].getText();

                            if (i === 0) {
                                const validDate = text.split("\n")[1] ?? "";
                                if (validDate) {
                                    lastValidStatus = "delivering";

                                    if (consoleStatus) {
                                        console.log("status resi", lastValidStatus);
                                    }

                                    const dateSplit = validDate.split(" ");
                                    const [day, month, year] = dateSplit[0].split("-");
                                    shipmentReceivedDate = `${year}-${month}-${day} ${dateSplit[1]}:00`;
                                    lastValidStatusDate = shipmentReceivedDate;
                                }
                            } else {
                                const validStatus = text.split("\n")[0] ?? "";
                                const validDate = text.split("\n")[1] ?? "";

                                if (validStatus.includes("RETURN SHIPMENT")) {
                                    lastValidStatus = "retur";

                                    if (consoleStatus) {
                                        console.log("status resi", lastValidStatus);
                                    }

                                    if (validDate) {
                                        const dateSplit = validDate.split(" ");
                                        const [day, month, year] = dateSplit[0].split("-");
                                        lastValidStatusDate = `${year}-${month}-${day} ${dateSplit[1]}:00`;
                                    }
                                    break;
                                } else if (validStatus.includes("DELIVERED")) {
                                    lastValidStatus = "delivered";

                                    if (consoleStatus) {
                                        console.log("status resi", lastValidStatus);
                                    }
                                    
                                    if (validDate) {
                                        const dateSplit = validDate.split(" ");
                                        const [day, month, year] = dateSplit[0].split("-");
                                        lastValidStatusDate = `${year}-${month}-${day} ${dateSplit[1]}:00`;
                                    }
                                    break;
                                // } else if (validStatus.includes("WITH DELIVERY COURIER") && validStatus.includes(destinationValue)) {
                                } else if (validStatus.includes("WITH DELIVERY COURIER")) {
                                    lastValidStatus = "in kurir";

                                    if (consoleStatus) {
                                        console.log("status resi", lastValidStatus);
                                    }

                                    if (validDate) {
                                        const dateSplit = validDate.split(" ");
                                        const [day, month, year] = dateSplit[0].split("-");
                                        lastValidStatusDate = `${year}-${month}-${day} ${dateSplit[1]}:00`;
                                    }
                                }
                            }
                        }

                        await driver.close();
                        await driver.switchTo().window(windowHandles[0]);

                        await updateAwbStatus(noResi, lastValidStatus, lastValidStatusDate, shipmentReceivedDate, estimatedDays);
                    } else {
                        await updateAwbStatus(noResi, "Data tidak ditemukan", null, null, null);
                    }
                } else {
                    await updateAwbStatus(noResi, "Data tidak ditemukan", null, null, null);
                }
            }
        }
    } catch (error) {
        console.log("cek resi gagal ", error.message);
    } finally {
        await driver.quit();
    }
};

setInterval(cekResiJne, process.env.CEK_RESI_INTERVAL);
