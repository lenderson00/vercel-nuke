const { spawn } = require("child_process");
const puppeteer = require("puppeteer");
const http = require("http");
const path = require("path");

const API_PORT = 4789, HTML_PORT = 4790;
const HTML_FILE = path.join(__dirname, "..", "index.html");

function get(p, port) {
  return new Promise((res, rej) => {
    http.get({host:"127.0.0.1", port, path:p, headers:{authorization:"Bearer t"}}, r => {
      let d=""; r.on("data",c=>d+=c); r.on("end",()=>res({status:r.statusCode, body:d}));
    }).on("error", rej);
  });
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));

(async () => {
  const srv = spawn("node", [path.join(__dirname,"mock-server.js")], {stdio:"inherit", env:{...process.env, HTML_FILE}});
  await sleep(800);
  let fail = [];
  const assert = (c,m) => { if(!c){ fail.push(m); console.log("  FAIL: "+m); } else console.log("  ok: "+m); };

  const browser = await puppeteer.launch({headless:"new", args:["--no-sandbox"]});
  const page = await browser.newPage();
  page.on("console", m => { if(m.type()==="error") console.log("[pageerr]", m.text()); });
  let pageThrew=null;
  page.on("pageerror", e => { pageThrew=e.message; console.log("[pagethrow]", e.message); });

  await page.goto("http://127.0.0.1:"+HTML_PORT+"/");
  await page.evaluate((b)=>localStorage.setItem("vz_api_base", b), "http://127.0.0.1:"+API_PORT);
  await page.reload();
  await page.evaluate(()=>localStorage.setItem("vz_min_scan","250"));

  // === v6: token field + Conectar button above the fold (connect step) ===
  for(const vp of [{w:1280,h:720,n:"1280x720"},{w:1366,h:768,n:"1366x768"},{w:390,h:844,n:"390x844"}]){
    await page.setViewport({width:vp.w, height:vp.h, deviceScaleFactor:1});
    await page.waitForFunction(()=>!document.getElementById("step-connect").classList.contains("hidden"), {timeout:4000});
    await sleep(150);
    const r = await page.evaluate(()=>{ const tok=document.getElementById("tok").getBoundingClientRect().bottom; const b=document.getElementById("btnConnect").getBoundingClientRect().bottom; return {tok, b}; });
    assert(r.tok < vp.h, "token input above the fold at "+vp.n+" (bottom "+Math.round(r.tok)+" < "+vp.h+")");
    assert(r.b < vp.h, "Conectar button above the fold at "+vp.n+" (bottom "+Math.round(r.b)+" < "+vp.h+")");
  }
  await page.setViewport({width:1280, height:900, deviceScaleFactor:1});

  // === v6: i18n PT/EN toggle changes headline and step labels ===
  assert((await page.$("#langTog"))!==null, "language toggle present in header");
  await page.evaluate(()=>window.__vz.setLang("pt-BR")); await sleep(900);
  const ptTitle = await page.$eval("#heroTitle", e=>e.textContent.trim());
  const ptStep0 = await page.$eval(".steps .step .lbl", e=>e.textContent.trim());
  await page.evaluate(()=>window.__vz.setLang("en")); await sleep(900);
  const enTitle = await page.$eval("#heroTitle", e=>e.textContent.trim());
  const enStep0 = await page.$eval(".steps .step .lbl", e=>e.textContent.trim());
  assert(ptTitle!==enTitle && /Vercel/.test(enTitle), "toggling to EN changes hero headline (pt=\""+ptTitle+"\" en=\""+enTitle+"\")");
  assert(ptStep0!==enStep0 && /Connect/i.test(enStep0), "toggling to EN changes step labels (pt=\""+ptStep0+"\" en=\""+enStep0+"\")");
  assert((await page.$eval("html", e=>e.getAttribute("lang")))==="en", "html lang attribute switches to en");
  // back to pt-BR for the rest of the flow
  await page.evaluate(()=>window.__vz.setLang("pt-BR")); await sleep(300);

  // STEP 1 connect
  await page.type("#tok", "faketoken");
  await page.click("#btnConnect");
  await page.waitForFunction(()=>!document.getElementById("step-scope").classList.contains("hidden"), {timeout:8000});
  assert((await page.$eval("#userName",e=>e.textContent))==="lenderson", "connect -> scope, username shown");
  assert((await page.$$eval(".scope-opt",os=>os.length))===2, "scope listbox has personal + 1 team");
  assert(await page.$$eval(".step", ss=>ss[1].classList.contains("active")), "stepper step 2 active");

  // custom scope popover: opens, shows options, Esc closes
  await page.click("#scopeTrigger");
  await page.waitForFunction(()=>document.getElementById("scopePop").classList.contains("open"), {timeout:3000});
  assert((await page.$eval("#scopeTrigger", t=>t.getAttribute("aria-expanded")))==="true", "scope popover aria-expanded true when open");
  // select the team option, verify trigger label updates
  await page.evaluate(()=>{ const o=[...document.querySelectorAll(".scope-opt")][1]; o.click(); });
  await sleep(150);
  assert(/Time/.test(await page.$eval("#scopeSub", e=>e.textContent)), "selecting team updates trigger label (Time)");
  // reopen and Esc closes
  await page.click("#scopeTrigger");
  await page.waitForFunction(()=>document.getElementById("scopePop").classList.contains("open"), {timeout:3000});
  await page.keyboard.press("Escape");
  await sleep(150);
  assert((await page.$eval("#scopePop", e=>e.classList.contains("open")))===false, "Esc closes scope popover");
  // reset scope back to personal for delete/slug flow
  await page.evaluate(()=>{ const o=[...document.querySelectorAll(".scope-opt")][0]; o.click(); });

  // STEP 2 -> list (v5 progressive loading)
  await page.click("#btnList");
  await page.waitForFunction(()=>!document.getElementById("step-inventory").classList.contains("hidden"), {timeout:5000});
  // the scan "loading moment" overlay appears
  await page.waitForFunction(()=>{const o=document.getElementById("scanOverlay"); return o && o.classList.contains("open");}, {timeout:5000});
  assert(true, "scan loading overlay shown after listing starts");
  // sidebar shell: all 9 rows present immediately while still loading
  const shellCount = await page.$$eval(".sidebar .side-item", ts=>ts.length);
  assert(shellCount===9, "sidebar shows all 9 categories immediately (shell) (got "+shellCount+")");
  // a fast category finishes before the slow one (deployments has an artificial delay)
  await page.waitForFunction(()=>{const s=document.querySelector(".side-item[data-cat=\"edgeconfig\"]"); return s && !s.classList.contains("loading");}, {timeout:8000});
  const prog = await page.evaluate(()=>({
    edgeDone: !document.querySelector(".side-item[data-cat=\"edgeconfig\"]").classList.contains("loading"),
    depLoading: document.querySelector(".side-item[data-cat=\"deployments\"]").classList.contains("loading"),
    skel: document.querySelectorAll(".panel[data-cat=\"deployments\"] .skel-row").length
  }));
  assert(prog.edgeDone, "fast category (edgeconfig) finished first");
  assert(prog.depLoading, "slow category (deployments) still loading while another is done (progressive)");
  assert(prog.skel>0, "skeleton shimmer rows visible in a still-loading panel");
  // everything finishes; overlay auto-dismisses
  await page.waitForFunction(()=>{const b=document.getElementById("invStatus"); return b && /recursos/.test(b.textContent);}, {timeout:15000});
  await page.waitForFunction(()=>!document.getElementById("scanOverlay").classList.contains("open"), {timeout:6000});

  // v4: top chrome hidden in inventory (app-mode)
  await page.waitForFunction(()=>document.body.classList.contains("app-mode"), {timeout:5000});
  assert((await page.$eval("#topbar", e=>getComputedStyle(e).display))==="none", "topbar hidden on inventory");
  assert((await page.$eval("#hero", e=>getComputedStyle(e).display))==="none", "hero hidden on inventory");
  assert((await page.$eval("#stepper", e=>getComputedStyle(e).display))==="none", "stepper hidden on inventory");
  assert((await page.$$eval(".sidebar .side-item", ts=>ts.length))===9, "sidebar renders 9 category items");
  // v4: chrome restored when going back to scope, then return to inventory
  await page.evaluate(()=>document.getElementById("btnTrocar").click());
  await page.waitForFunction(()=>!document.body.classList.contains("app-mode"), {timeout:5000});
  assert((await page.$eval("#stepper", e=>getComputedStyle(e).display))!=="none", "chrome (stepper) restored when leaving inventory (v6: hero shows only on connect step)");
  await page.click("#btnList");
  await page.waitForFunction(()=>!document.getElementById("step-inventory").classList.contains("hidden"), {timeout:5000});
  await page.waitForFunction(()=>{const b=document.getElementById("invStatus"); return b && /recursos/.test(b.textContent);}, {timeout:15000});
  await page.waitForFunction(()=>document.body.classList.contains("app-mode"), {timeout:5000});
  await page.waitForFunction(()=>{const b=document.getElementById("invStatus"); return b && /recursos/.test(b.textContent);}, {timeout:15000});
  await page.waitForFunction(()=>!document.getElementById("scanOverlay").classList.contains("open"), {timeout:6000});

  // v6: single full-page background shader present; old shaders/ascii logo removed
  assert(await page.$("#bgShader")!==null, "full-page background shader canvas present (WebGL or CSS fallback)");
  assert(await page.$("#heroShader")===null, "old hero shader canvas removed");
  assert(await page.$("#heroLogo")===null, "old ascii hero logo removed");
  assert(await page.$("#confirmShader")===null, "old confirm shader removed");
  assert(await page.$("#scanLogo")===null, "old scan ascii logo removed");

  // tabs: one per category
  assert((await page.$$eval(".side-item", ts=>ts.length))===9, "9 category sidebar items rendered");
  const depCount = await page.$eval('.side-item[data-cat="deployments"] .si-count', e=>e.textContent);
  assert(depCount==="4", "deployments sidebar count = 4 (paginated) (got "+depCount+")");
  // empty categories dimmed? none empty here, but class 'empty' should be absent on deployments
  assert((await page.$eval('.side-item[data-cat="deployments"]', e=>e.classList.contains("empty")))===false, "non-empty sidebar item not dimmed");

  // all panels present in DOM even if hidden
  assert((await page.$$eval(".panel", ps=>ps.length))===9, "9 panels present in DOM");

  const defsel = await page.evaluate(()=>{
    const out={};
    ["integrations","edgeconfig","webhooks","env","aliases","deployments","projects","domains","storage"].forEach(k=>{
      const cbs=[...document.querySelectorAll('.itemcb[data-cat="'+k+'"]')];
      out[k]=cbs.length?cbs.every(c=>c.checked):null;
    });
    return out;
  });
  console.log("  defaultSel:", JSON.stringify(defsel));
  assert(defsel.integrations===false, "integrations unselected by default");
  assert(defsel.deployments===false, "deployments unselected by default");
  assert(defsel.projects===true, "projects selected by default");

  // tab switch works
  await page.evaluate(()=>window.__vz.switchTab("projects"));
  await sleep(150);
  assert((await page.$eval('.panel[data-cat="projects"]', e=>e.classList.contains("active")))===true, "switchTab shows projects panel");
  assert((await page.$eval('.side-item[data-cat="projects"]', e=>e.classList.contains("active")))===true, "projects sidebar item marked active");

  // DETAILS DRAWER: open project row, verify framework shown, Esc closes
  await page.click('.panel[data-cat="projects"] .rowopen');
  await page.waitForFunction(()=>document.getElementById("drawer").classList.contains("open"), {timeout:3000});
  assert((await page.$eval("#drawer", e=>e.getAttribute("aria-hidden")))==="false", "drawer open aria-hidden false");
  const drawerBody = await page.$eval("#drawerBody", e=>e.textContent);
  assert(/nextjs/.test(drawerBody), "drawer shows project framework (nextjs)");
  assert(/lenderson\/site-a/.test(drawerBody), "drawer shows repo link");
  await page.keyboard.press("Escape");
  await sleep(150);
  assert((await page.$eval("#drawer", e=>e.getAttribute("aria-hidden")))==="true", "Esc closes drawer (aria-hidden true)");

  // drawer for a deployment shows state/target
  await page.evaluate(()=>window.__vz.openDrawer("deployments", 2));
  await sleep(150);
  const depBody = await page.$eval("#drawerBody", e=>e.textContent);
  assert(/ERROR/.test(depBody) && /preview/.test(depBody), "deployment drawer shows ERROR/preview detail");
  await page.evaluate(()=>window.__vz.closeDrawer());
  await sleep(300);

  // v4: deployment status filter chips (data from list API only)
  await page.evaluate(()=>window.__vz.switchTab("deployments"));
  await sleep(150);
  await page.evaluate(()=>{ document.querySelectorAll('.itemcb').forEach(c=>{c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true}));}); });
  const errChipN = await page.$eval('.panel[data-cat="deployments"] .chip[data-f="err"] .chipn', e=>e.textContent);
  assert(errChipN==="1", "deployments Com erro chip count = 1 (got "+errChipN+")");
  await page.click('.panel[data-cat="deployments"] .chip[data-f="err"]');
  await sleep(150);
  const selErr = await page.evaluate(()=>[...document.querySelectorAll('.itemcb[data-cat="deployments"]')].filter(c=>c.checked).map(c=>parseInt(c.getAttribute("data-idx"),10)));
  assert(selErr.length===1, "Com erro selects exactly 1 deployment (got "+selErr.length+")");
  assert((await page.$eval('.panel[data-cat="deployments"] .chip[data-f="err"]', e=>e.classList.contains("active")))===true, "error chip marked active after apply");
  const selState = await page.evaluate(idx=>window.__vz.state.data.deployments[idx].raw.readyState, selErr[0]);
  assert(selState==="ERROR", "filtered selection is the ERROR deployment (got "+selState+")");
  const canChipN = await page.$eval('.panel[data-cat="deployments"] .chip[data-f="canceled"] .chipn', e=>e.textContent);
  assert(canChipN==="1", "deployments Cancelados chip count = 1 (got "+canChipN+")");
  await page.click('.panel[data-cat="deployments"] .chip[data-f="canceled"]');
  await sleep(150);
  const selCan = await page.evaluate(()=>[...document.querySelectorAll('.itemcb[data-cat="deployments"]')].filter(c=>c.checked).length);
  assert(selCan===1, "Cancelados replaces selection to 1 (got "+selCan+")");
  // manual toggle clears active chip indicator
  await page.evaluate(()=>{ const c=document.querySelector('.itemcb[data-cat="deployments"]'); c.checked=!c.checked; c.dispatchEvent(new Event('change',{bubbles:true})); });
  await sleep(100);
  assert((await page.$$eval('.panel[data-cat="deployments"] .chip.active', a=>a.length))===0, "manual change clears active filter chip");
  await page.evaluate(()=>window.__vz.switchTab("projects"));
  await sleep(100);

  // selected counter > 0 and continue enabled
  const selN = await page.$eval("#selCount", e=>parseInt(e.textContent,10));
  assert(selN>0, "global selected counter > 0 (got "+selN+")");
  assert((await page.$eval("#btnGoConfirm", b=>b.disabled))===false, "continue button enabled when items selected");

  // unselect all -> counter 0 -> continue disabled
  await page.evaluate(()=>{ document.querySelectorAll('.itemcb').forEach(c=>{c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true}));}); });
  assert((await page.$eval("#selCount", e=>parseInt(e.textContent,10)))===0, "unselect all -> counter 0");
  assert((await page.$eval("#btnGoConfirm", b=>b.disabled))===true, "continue disabled with 0 selected");

  // reselect everything (incl integrations + deployments) to delete all
  await page.evaluate(()=>{ document.querySelectorAll('.itemcb').forEach(c=>{c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}));}); });
  await page.click("#btnGoConfirm");
  await page.waitForFunction(()=>!document.getElementById("step-confirm").classList.contains("hidden"), {timeout:5000});

  // STEP 4 confirm: summary + guard (confirmTotal counts up, wait for it to settle)
  await page.waitForFunction(()=>parseInt(document.getElementById("confirmTotal").textContent,10)>0, {timeout:3000});
  const confTotal = await page.$eval("#confirmTotal", e=>parseInt(e.textContent,10));
  assert(confTotal>0, "confirm summary total > 0 (got "+confTotal+")");
  assert((await page.$eval("#btnDelete", b=>b.disabled))===true, "delete disabled before typing slug");
  await page.type("#confirm", "WRONG");
  assert((await page.$eval("#btnDelete", b=>b.disabled))===true, "delete still disabled with wrong slug");
  await page.evaluate(()=>{ const b=document.getElementById("btnDelete"); b.disabled=false; b.click(); });
  await sleep(400);
  assert((await page.$eval("#step-result", e=>e.classList.contains("hidden")))===true, "wrong slug does not advance to result");
  const projBefore = JSON.parse((await get("/v10/projects", API_PORT)).body).projects.length;
  assert(projBefore===2, "no projects deleted after wrong slug (got "+projBefore+")");

  // correct slug
  await page.$eval("#confirm", e=>e.value="");
  await page.type("#confirm", "lenderson");
  assert((await page.$eval("#btnDelete", b=>b.disabled))===false, "delete enabled with correct slug");
  await page.click("#btnDelete");
  await page.waitForFunction(()=>!document.getElementById("step-result").classList.contains("hidden"), {timeout:5000});
  await page.waitForFunction(()=>{const l=document.getElementById("log"); return l && /Conclu/.test(l.textContent);}, {timeout:30000});

  const logText = await page.$eval("#log", e=>e.textContent);
  assert(/limite de requisi/.test(logText), "429 retry exercised");
  assert((await page.$eval("#okCount", e=>parseInt(e.textContent,10)))>0, "final ok count > 0");
  assert((await page.$eval("#errCount", e=>parseInt(e.textContent,10)))===0, "final error count 0");
  assert((await page.$eval("#finalSummary", e=>!e.classList.contains("hidden")))===true, "final summary visible");
  assert((await page.$eval("#progBar", e=>e.style.width))==="100%", "progress bar at 100%");

  // server emptied
  const g = async p => JSON.parse((await get(p,API_PORT)).body);
  assert((await g("/v1/integrations/configurations")).length===0, "integrations emptied");
  assert((await g("/v1/edge-config")).length===0, "edge-config emptied");
  assert((await g("/v1/webhooks")).length===0, "webhooks emptied");
  assert((await g("/v1/env")).data.length===0, "env emptied (bulk)");
  assert((await g("/v4/aliases")).aliases.length===0, "aliases emptied");
  assert((await g("/v10/projects")).projects.length===0, "projects emptied");
  assert((await g("/v5/domains")).domains.length===0, "domains emptied");
  assert((await g("/v1/storage/stores")).stores.length===0, "stores emptied");
  assert((await g("/v6/deployments")).deployments.length===0, "deployments emptied");

  // === v6.2: loading transition - default minimum hold, no layout jump ===
  {
    const tp = await browser.newPage();
    tp.on("pageerror", e => { pageThrew = pageThrew || e.message; console.log("[pagethrow-tp]", e.message); });
    await tp.setViewport({width:1366, height:768, deviceScaleFactor:1});
    await tp.goto("http://127.0.0.1:"+HTML_PORT+"/");
    await tp.evaluate((b)=>localStorage.setItem("vz_api_base", b), "http://127.0.0.1:"+API_PORT);
    await tp.evaluate(()=>localStorage.removeItem("vz_min_scan"));
    await tp.reload();
    await tp.type("#tok","faketoken"); await tp.click("#btnConnect");
    await tp.waitForFunction(()=>!document.getElementById("step-scope").classList.contains("hidden"), {timeout:8000});
    await tp.evaluate(()=>{ const o=[...document.querySelectorAll(".scope-opt")][0]; o.click(); });
    const sw0 = await tp.evaluate(()=>document.documentElement.scrollWidth);
    const tStart = Date.now();
    await tp.click("#btnList");
    await tp.waitForFunction(()=>{const o=document.getElementById("scanOverlay"); return o && o.classList.contains("open");}, {timeout:5000});
    await sleep(4800);
    const stillOpen = await tp.evaluate(()=>document.getElementById("scanOverlay").classList.contains("open"));
    assert(stillOpen, "loader respects ~6s minimum hold (still visible at 4.8s)");
    await tp.waitForFunction(()=>!document.getElementById("scanOverlay").classList.contains("open"), {timeout:9000});
    const held = Date.now()-tStart;
    assert(held>=5000, "loader total hold >= 5s by default (got "+held+"ms)");
    await sleep(1000);
    const sw1 = await tp.evaluate(()=>document.documentElement.scrollWidth);
    assert(Math.abs(sw1-sw0)<=2, "no horizontal layout jump across the transition (scrollWidth "+sw0+" -> "+sw1+")");
    const bb1 = await tp.evaluate(()=>{const w=document.querySelector(".workspace").getBoundingClientRect(); return {x:Math.round(w.x), y:Math.round(w.y), w:Math.round(w.width)};});
    await sleep(600);
    const bb2 = await tp.evaluate(()=>{const w=document.querySelector(".workspace").getBoundingClientRect(); return {x:Math.round(w.x), y:Math.round(w.y), w:Math.round(w.width)};});
    assert(bb1.x===bb2.x && bb1.w===bb2.w && Math.abs(bb1.y-bb2.y)<=1, "workspace bounding box stable after entrance ("+JSON.stringify(bb1)+" vs "+JSON.stringify(bb2)+")");
    await tp.close();
  }

  // === v6.2: skip button skips the minimum hold ===
  {
    const sp = await browser.newPage();
    sp.on("pageerror", e => { pageThrew = pageThrew || e.message; console.log("[pagethrow-sp]", e.message); });
    await sp.setViewport({width:1366, height:768, deviceScaleFactor:1});
    await sp.goto("http://127.0.0.1:"+HTML_PORT+"/");
    await sp.evaluate((b)=>localStorage.setItem("vz_api_base", b), "http://127.0.0.1:"+API_PORT);
    await sp.evaluate(()=>localStorage.removeItem("vz_min_scan"));
    await sp.reload();
    await sp.type("#tok","faketoken"); await sp.click("#btnConnect");
    await sp.waitForFunction(()=>!document.getElementById("step-scope").classList.contains("hidden"), {timeout:8000});
    await sp.evaluate(()=>{ const o=[...document.querySelectorAll(".scope-opt")][0]; o.click(); });
    await sp.click("#btnList");
    await sp.waitForFunction(()=>{const b=document.getElementById("scanSkip"); return b && !b.disabled;}, {timeout:6000});
    const tSkip = Date.now();
    await sp.evaluate(()=>document.getElementById("scanSkip").click());
    await sp.waitForFunction(()=>!document.getElementById("scanOverlay").classList.contains("open"), {timeout:4000});
    const dt = Date.now()-tSkip;
    assert(dt<2500, "skip dismisses loader well before the 6s minimum (got "+dt+"ms)");
    await sp.close();
  }

  assert(!pageThrew, "no uncaught page errors (WebGL fallback stays safe): "+(pageThrew||""));
  await browser.close();
  srv.kill();
  console.log("\n==== " + (fail.length? ("FAILED: "+fail.length) : "ALL PASSED") + " ====");
  process.exit(fail.length?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
