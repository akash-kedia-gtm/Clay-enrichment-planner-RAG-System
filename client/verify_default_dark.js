import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = '/Users/akash/.gemini/antigravity/brain/2885f882-8f92-4658-aaef-44bb85a28a22';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function verifyDefaultDarkMode() {
  console.log('Testing fresh load default dark mode...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,1000'],
    defaultViewport: { width: 1440, height: 1000 },
  });

  // Create incognito context so localStorage is completely blank
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000 on clean profile...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const headerThemeText = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('header button'));
    const themeBtn = btns.find((b) => b.getAttribute('aria-label') === 'Toggle theme mode');
    return themeBtn ? themeBtn.innerText : '';
  });

  console.log(`Default Dark Mode Active on clean profile: ${isDark}`);
  console.log(`Header Button Text: "${headerThemeText}"`);

  if (!isDark) {
    throw new Error('Default dark mode was NOT active on clean profile!');
  }

  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_09_default_dark_fresh_load.png`, fullPage: false });
  console.log('Saved screenshot clay_09_default_dark_fresh_load.png');

  await browser.close();
  console.log('Default Dark Mode verification verified successfully!');
}

verifyDefaultDarkMode().catch((err) => {
  console.error('Error during default dark mode test:', err);
  process.exit(1);
});

