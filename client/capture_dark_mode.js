import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = '/Users/akash/.gemini/antigravity/brain/2885f882-8f92-4658-aaef-44bb85a28a22';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function testDarkMode() {
  console.log('Launching headless Chrome for Dark Mode verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,1100'],
    defaultViewport: { width: 1440, height: 1100 },
  });

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // 1. Ensure starting in light mode
  await page.evaluate(() => {
    localStorage.setItem('clay_theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await new Promise((r) => setTimeout(r, 300));

  console.log('Capturing Light Mode with Dark Mode Toggle Button in Header...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_06_light_mode_with_button.png`, fullPage: false });

  // 2. Click the Dark Mode Toggle button
  console.log('Clicking Dark Mode Toggle Button in Header...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('header button'));
    const darkBtn = btns.find((b) => b.getAttribute('aria-label') === 'Toggle theme mode' || b.innerText.includes('Dark'));
    if (darkBtn) darkBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log(`Document dark class active: ${isDark}`);

  console.log('Capturing Dark Mode Initial View...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_07_dark_mode_initial.png`, fullPage: false });

  // 3. Run a quick workflow in Dark Mode
  console.log('Running linear.app in Dark Mode...');
  await page.waitForSelector('input#company-url');
  await page.type('input#company-url', 'linear.app');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const analyzeBtn = btns.find((b) => b.innerText.includes('Analyze'));
    if (analyzeBtn) analyzeBtn.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Select Campaign Strategy'), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Capturing Dark Mode Campaign Strategy Proposals...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_08_dark_mode_campaigns.png`, fullPage: false });

  await browser.close();
  console.log('Dark mode verification complete!');
}

testDarkMode().catch((err) => {
  console.error('Error during dark mode capture:', err);
  process.exit(1);
});

