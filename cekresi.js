const { Builder, Browser, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async function example() {
  let options = new chrome.Options();
  options.addArguments('--headless'); // Menjalankan Chrome dalam mode headless

  let driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();

  try {
    await driver.get('https://www.jne.co.id/');
    driver.wait(function() {
        return driver.executeScript('return document.readyState').then(function(readyState) {
            return readyState === 'complete';
        });
    });

    const initialUrl = await driver.getCurrentUrl();
    console.log("URL sebelum klik:", initialUrl);
    
    const inputField = await driver.findElement(By.className('tagify__input'));
    // await inputField.sendKeys("0137222400681678");
    await inputField.sendKeys("0137222400670275");
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

    let finalUrl = await driver.getCurrentUrl();
    console.log("URL setelah klik:", finalUrl);

    try {
        const statusElement = await driver.findElement(By.css('td[data-label="Status"]'));
        const statusText = await statusElement.getText();
        console.log("Status:", statusText);
    } catch (error) {
        console.log("Data tidak ditemukan");
    }

  } finally {
    await driver.quit();
  }
})();
