const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // 1. Grab the IDs passed from the GitHub workflow trigger
    const ids = process.env.BATTLE_IDS;
    if (!ids) {
        console.error("No battle IDs provided.");
        process.exit(1);
    }

    const safeFileName = ids.split(',').map(id => id.trim()).join('_');
    const imgDir = path.join(__dirname, 'battle-images');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

    console.log(`Launching headless browser to capture matches: ${ids}`);
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Set a high-definition viewport frame size
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });

    // Go to your live GitHub pages site for these specific matches
    const targetUrl = `https://albionnft.github.io/NFT/battleboards.html?ids=${ids}`;
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    try {
        // Wait specifically for your javascript loops to write data to the table
        await page.waitForSelector('#alliance-rows tr', { timeout: 6000 });

        // Select ONLY the Alliance Summary Card block
        const element = await page.$('#alliance-summary-card');
        if (element) {
            await element.screenshot({
                path: path.join(imgDir, `summary_${safeFileName}.png`)
            });
            console.log(`Saved screenshot: summary_${safeFileName}.png`);
        } else {
            console.error("Could not find #alliance-summary-card on the page.");
        }
    } catch (err) {
        console.error("Render timed out or failed to parse data:", err);
    }

    await browser.close();
})();