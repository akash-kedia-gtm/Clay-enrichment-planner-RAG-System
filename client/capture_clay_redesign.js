import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = '/Users/akash/.gemini/antigravity/brain/2885f882-8f92-4658-aaef-44bb85a28a22';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function captureClayRedesign() {
  console.log('Launching headless Chrome for Clay redesign visual verification...');
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

  // 1. Initial State: Stacked layout with Section 1 below header and Section 2 below Section 1
  console.log('Capturing Initial Stacked Layout with Clay colors & typography...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_01_initial_stacked_layout.png`, fullPage: false });

  // 2. Submit URL
  console.log('Submitting linear.app...');
  await page.waitForSelector('input#company-url');
  await page.type('input#company-url', 'linear.app');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const analyzeBtn = btns.find((b) => b.innerText.includes('Analyze'));
    if (analyzeBtn) analyzeBtn.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Select Campaign Strategy'), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Capturing Campaign Proposals in Section 1 and Company Intelligence in Section 2...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_02_campaign_proposals.png`, fullPage: false });

  // 3. Approve Campaign to trigger 3rd LLM call (Company Personas)
  console.log('Approving campaign...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((btn) => btn.innerText.includes('Approve Campaign'));
    if (b) b.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Select Target Company Persona') || document.body.innerText.includes('Select Gating Decision Question'), { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Capturing 3 Company Personas proposed for user approval...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_03_persona_proposals.png`, fullPage: false });

  // 4. Approve Persona to trigger RAG pipeline (dissection, catalog retrieval, plan)
  console.log('Approving company persona...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((btn) =>
      btn.innerText.includes('Approve Company Persona') ||
      btn.innerText.includes('Build Enrichment Plan') ||
      btn.innerText.includes('Approve Question')
    );
    if (b) {
      console.log('Found button:', b.innerText);
      b.click();
    } else {
      console.error('Approve button NOT found! Available buttons:', btns.map(x => x.innerText));
    }
  });

  await page.waitForFunction(
    () => document.body.innerText.includes('Clay Enrichment Plan Ready') || document.body.innerText.includes('Waterfall Steps'),
    { timeout: 20000 }
  );
  await new Promise((r) => setTimeout(r, 1200));

  console.log('Capturing Clay Enrichment Waterfall Plan...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_04_enrichment_plan_waterfall.png`, fullPage: false });

  // Scroll down to capture Section 2's rich flow cards
  await page.evaluate(() => {
    window.scrollBy(0, 500);
  });
  await new Promise((r) => setTimeout(r, 600));
  console.log('Capturing Section 2 Execution Flow & RAG Intelligence...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/clay_05_section2_flow_cards.png`, fullPage: false });

  await browser.close();
  console.log('All Clay redesign screenshots captured successfully!');
}

captureClayRedesign().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});

