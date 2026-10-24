const puppeteer = require("puppeteer");
const path = require("path");
(async () => {
  const tpl = "file://" + path.resolve(__dirname, "og-template.html");
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox","--force-color-profile=srgb"] });
  const jobs = [
    { lang:"en", out:"../og.png" },
    { lang:"pt", out:"../og-pt.png" }
  ];
  for (const j of jobs) {
    const page = await browser.newPage();
    await page.setViewport({ width:1200, height:630, deviceScaleFactor:1 });
    await page.goto(tpl + "?lang=" + j.lang, { waitUntil:"networkidle0" });
    await page.waitForSelector('html[data-ready="1"]');
    await new Promise(r=>setTimeout(r,120));
    await page.screenshot({ path: path.resolve(__dirname, j.out), type:"png" });
    console.log("wrote", j.out);
    await page.close();
  }
  // apple-touch-icon 180x180 (rounded white square + dark triangle on dark bg)
  const icon = `data:text/html,<!doctype html><meta charset=utf-8><body style="margin:0"><div style="width:180px;height:180px;background:#0a0a0a;display:flex;align-items:center;justify-content:center"><div style="width:132px;height:132px;border-radius:34px;background:#fafafa;display:flex;align-items:center;justify-content:center"><svg width="80" height="80" viewBox="0 0 24 24" fill="#0a0a0a"><path d="M12 2L22 20H2L12 2z"/></svg></div></div></body>`;
  const ip = await browser.newPage();
  await ip.setViewport({ width:180, height:180, deviceScaleFactor:1 });
  await ip.goto(icon, { waitUntil:"networkidle0" });
  await ip.screenshot({ path: path.resolve(__dirname, "../apple-touch-icon.png"), type:"png" });
  console.log("wrote ../apple-touch-icon.png");
  await browser.close();
})().catch(e=>{ console.error(e); process.exit(1); });
