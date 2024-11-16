const { Builder, Browser, By, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { fetchAwbsByLogistic, updateAwbStatus, fetchLogisticByName } = require('./dbService');

const cekResiJne = async () => {
    let options = new chrome.Options();
    options.addArguments('--headless'); 

    let driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
    
    try {
        const logisticId = await fetchLogisticByName('jne');
        if (!logisticId) {
            throw new Error('Logistic JNE tidak ditemukan.');
        }

        const awbs = await fetchAwbsByLogistic(logisticId);

        if (awbs.length === 0) {
            return { status: 'success', message: 'Tidak ada data AWB untuk JNE.' };
        }

        await driver.get('https://www.jne.co.id/tracking-package');
        await driver.wait(() => {
            return driver.executeScript('return document.readyState').then((readyState) => {
                return readyState === 'complete';
            });
        });

        const inputField = await driver.findElement(By.className('tagify__input'));

        for (const awb of awbs) {
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

                        await updateAwbStatus(noResi, lastValidItem);
                    } else {
                        await updateAwbStatus(noResi, status);
                    }
                } else {
                    await updateAwbStatus(noResi, status);
                }
            } else {
                await updateAwbStatus(noResi, "Data tidak ditemukan");
            }
        }
        
        console.log("cek resi sukses");
    } catch (error) {
        console.log("cek resi gagal");
    } finally {
        await driver.quit();
    }
};

module.exports = { cekResiJne };
