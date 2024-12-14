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
    options.addArguments('--headless');

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
                    const status = await columns[7].getText();

                    if (status === "ON PROCESS") {
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

                            const timeline = await driver.findElement(By.css('ul.timeline.widget'));
                            const timelineItems = await timeline.findElements(By.css('li'));

                            let lastValidStatus = "";
                            let date = "";
                            for (let i = timelineItems.length - 1; i >= 0; i--) {
                                const text = await timelineItems[i].getText();

                                if (text.trim() !== "") {
                                    lastValidStatus = text.split("\n")[0] ?? "";

                                    const lastValidDate = text.split("\n")[1] ?? "";
                                    const dateSplit = lastValidDate.split(" ");
                                    const [day, month, year] = dateSplit[0].split("-");
                                    date = `${year}-${month}-${day} ${dateSplit[1]}:00`;
                                    break;
                                }
                            }

                            await driver.close();
                            await driver.switchTo().window(windowHandles[0]);

                            await updateAwbStatus(noResi, lastValidStatus, date);
                        } else {
                            await updateAwbStatus(noResi, status, null);
                        }
                    } else {
                        const lastValidDate = await columns[5].getText();
                        const parsedDate = new Date(lastValidDate);
                    
                        const year = parsedDate.getFullYear();
                        const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
                        const day = String(parsedDate.getDate()).padStart(2, "0");
                        const hours = String(parsedDate.getHours()).padStart(2, "0");
                        const minutes = String(parsedDate.getMinutes()).padStart(2, "0");
                        const seconds = String(parsedDate.getSeconds()).padStart(2, "0");

                        const date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        await updateAwbStatus(noResi, status, date);
                    }
                } else {
                    await updateAwbStatus(noResi, "Data tidak ditemukan", null);
                }
            }
        }
    } catch (error) {
        console.log("cek resi gagal ", error.message);
    } finally {
        await driver.quit();
    }
};

module.exports = { cekResiJne };
