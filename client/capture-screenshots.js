import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = '/Users/akash/.gemini/antigravity/brain/2885f882-8f92-4658-aaef-44bb85a28a22';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function captureWalkthrough() {
  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1400,980'],
    defaultViewport: { width: 1400, height: 980 },
  });

  const page = await browser.newPage();
  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Initial State: Expand manual description accordion in Step 1
  console.log('Expanding manual description accordion...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const accBtn = btns.find((b) => b.innerText.includes('Supply description directly'));
    if (accBtn) accBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  console.log('Capturing Step 1 with manual description fallback...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/01_step1_with_manual_desc.png`, fullPage: false });

  // 2. Open GTM Method Modal
  console.log('Opening GTM Method Modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const gtmBtn = btns.find((b) => b.innerText.includes('GTM Method'));
    if (gtmBtn) gtmBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  console.log('Capturing GTM Method Modal...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/04_gtm_method_modal.png`, fullPage: false });

  // Close GTM modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const closeBtn = btns.find((b) => b.querySelector('svg.lucide-x') || b.innerText.includes('Close'));
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // 3. Submit URL to analyze company & propose campaigns
  console.log('Typing linear.app into input...');
  await page.waitForSelector('input#company-url');
  await page.type('input#company-url', 'linear.app');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const analyzeBtn = btns.find((b) => b.innerText.includes('Analyze'));
    if (analyzeBtn) analyzeBtn.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Select Campaign Strategy'), { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  console.log('Capturing Step 2 Campaign Selection with GTM Assumptions & Sources...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/02_step2_campaign_assumptions.png`, fullPage: false });

  // 4. Approve Campaign to generate decision questions
  console.log('Approving campaign...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((btn) => btn.innerText.includes('Approve Campaign'));
    if (b) b.click();
  });

  await page.waitForFunction(() => document.body.innerText.includes('Select Gating Decision Question'), { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  console.log('Capturing Step 3 Decision Questions with Categories & Actions Changed...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/03_step3_decision_questions_criteria.png`, fullPage: false });

  // 5. Approve Decision Question to execute C1, C2, C3, D, and E
  console.log('Approving decision question...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((btn) => btn.innerText.includes('Approve Question'));
    if (b) b.click();
  });

  await page.waitForFunction(
    () => document.body.innerText.includes('Waterfall Steps') || document.body.innerText.includes('Clay Enrichment Plan Ready'),
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 1000));

  console.log('Capturing Step 5 Enrichment Plan Waterfall...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/05_step5_enrichment_plan_waterfall.png`, fullPage: false });

  // 6. Switch to Billing Formulas Tab
  console.log('Switching to Billing Formulas Tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const billingBtn = btns.find((b) => b.innerText.includes('Billing Formulas'));
    if (billingBtn) billingBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  console.log('Capturing Billing Formulas calculated in code...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/06_step5_billing_formulas.png`, fullPage: false });

  // 7. Capture Right Pane showing C1 rules, C2 outcomes (distinguishing missing data), C3 evidence
  console.log('Capturing Right Pane showing C1/C2/C3 Decision Breakdown...');
  await page.screenshot({ path: `${ARTIFACT_DIR}/07_right_pane_checkpoints_c1_c2_c3.png`, fullPage: false });

  await browser.close();
  console.log('All workflow verification screenshots captured successfully!');
}

captureWalkthrough().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
