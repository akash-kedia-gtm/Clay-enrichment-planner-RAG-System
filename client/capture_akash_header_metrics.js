import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = '/Users/akash/.gemini/antigravity/brain/2885f882-8f92-4658-aaef-44bb85a28a22';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function captureChanges() {
  console.log('Verifying Header subtitle and Step 5 metrics banner...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,1050'],
    defaultViewport: { width: 1440, height: 1050 },
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // 1. Verify Header link and text
  const headerSubtitle = await page.evaluate(() => {
    const p = document.querySelector('header p');
    const a = p ? p.querySelector('a') : null;
    return {
      text: p ? p.innerText : '',
      href: a ? a.href : '',
    };
  });
  console.log('Header Subtitle Info:', headerSubtitle);

  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_10_header_by_akash_kedia.png`, fullPage: false });
  console.log('Saved clay_10_header_by_akash_kedia.png');

  // 2. Walk to Step 5 to verify metrics banner
  console.log('Navigating to Step 5 (linear.app)...');
  await page.waitForSelector('input#company-url');
  await page.type('input#company-url', 'linear.app');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const analyzeBtn = btns.find((b) => b.innerText.includes('Analyze'));
    if (analyzeBtn) analyzeBtn.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Select Campaign Strategy'), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 800));

  // Approve Campaign
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((btn) => btn.innerText.includes('Approve Campaign'));
    if (b) b.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Select Target Company Persona') || document.body.innerText.includes('Select Gating Decision Question'), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 800));

  // Approve Persona
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((btn) =>
      btn.innerText.includes('Approve Company Persona') ||
      btn.innerText.includes('Build Enrichment Plan') ||
      btn.innerText.includes('Approve Question')
    );
    if (b) b.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Clay Enrichment Plan Ready'), { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1000));

  // Verify that Est. Cost / 1,000 Accounts is NOT present
  const metricsText = await page.evaluate(() => {
    const banner = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2');
    return banner ? banner.innerText : '';
  });
  console.log('Updated Metrics Banner Content:\n', metricsText);

  const hasOldCost = metricsText.includes('Est. Cost / 1,000 Accounts');
  console.log('Contains old Est. Cost / 1,000 Accounts?:', hasOldCost);

  if (hasOldCost) {
    throw new Error('Old Est. Cost / 1,000 Accounts metric is still visible!');
  }

  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_11_step5_metrics_banner_updated.png`, fullPage: false });
  console.log('Saved clay_11_step5_metrics_banner_updated.png');

  await browser.close();
  console.log('Verification script completed successfully!');
}

captureChanges().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});

