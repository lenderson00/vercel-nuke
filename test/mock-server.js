// Mock Vercel API for testing zerar-vercel.html. Node built-ins only.
const http = require("http");
const fs = require("fs");
const path = require("path");

// in-memory store
function reset() {
  return {
    user: { user: { uid:"u_1", username:"lenderson", email:"l@example.com" } },
    teams: { teams: [ { id:"team_abc", slug:"meu-time", name:"Meu Time" } ] },
    integrations: [
      {id:"icfg_1", slug:"neon", integrationId:"oac_neon", addedAt:1718900000000, scopes:["read","write"]},
      {id:"icfg_2", slug:"slack", integrationId:"oac_slack", addedAt:1719900000000, scopes:["read"]}
    ],
    edgeConfig: [
      {id:"ec_1", slug:"cfg-a", createdAt:1718000000000, updatedAt:1726000000000, itemCount:12, sizeInBytes:2048},
      {id:"ec_2", slug:"cfg-b", createdAt:1719000000000, updatedAt:1726500000000, itemCount:3, sizeInBytes:512}
    ],
    webhooks: [ {id:"wh_1", url:"https://hook.example/1", events:["deployment.created","deployment.error"], createdAt:1720000000000, projectIds:["prj_1"]} ],
    env: [
      {id:"env_1", key:"API_KEY", type:"encrypted", target:["production","preview"], createdAt:1717000000000},
      {id:"env_2", key:"SECRET", type:"encrypted", target:["production"], createdAt:1717500000000}
    ],
    aliases: [
      {uid:"al_1", alias:"foo.vercel.app", deploymentId:"dpl_1", deployment:{url:"p1.vercel.app"}, createdAt:1722000000000},
      {uid:"al_2", alias:"bar.vercel.app", deploymentId:"dpl_2", deployment:{url:"p2.vercel.app"}, createdAt:1723000000000}
    ],
    // deployments: paginated across 2 pages
    deployments: [
      {uid:"dpl_1", name:"p1", url:"p1.vercel.app", readyState:"READY", target:"production", createdAt:1725000000000, creator:{username:"lenderson"}},
      {uid:"dpl_2", name:"p2", url:"p2.vercel.app", readyState:"READY", target:"production", createdAt:1725100000000, creator:{username:"lenderson"}},
      {uid:"dpl_3", name:"p3", url:"p3.vercel.app", readyState:"ERROR", target:"preview", createdAt:1725200000000, creator:{username:"lenderson"}},
      {uid:"dpl_4", name:"p3", url:"p3-git-feature.vercel.app", readyState:"CANCELED", target:"preview", createdAt:1725300000000, creator:{username:"lenderson"}}
    ],
    projects: [
      {id:"prj_1", name:"site-a", framework:"nextjs", createdAt:1710000000000, updatedAt:1726000000000, link:{type:"github", org:"lenderson", repo:"site-a"}},
      {id:"prj_2", name:"site-b", framework:"vite", createdAt:1712000000000, updatedAt:1726200000000}
    ],
    domains: [
      {name:"example.com", verified:true, serviceType:"external", createdAt:1700000000000, expiresAt:1760000000000},
      {name:"test.dev", verified:false, serviceType:"zeit.world", createdAt:1715000000000}
    ],
    stores: [ {id:"store_blob_1", name:"blob1", type:"blob", createdAt:1721000000000, size:104857600} ],
    retryArmed: true // one 429 on first project delete
  };
}

// marketing-only rich dataset, gated by MOCK_RICH=1 (committed tests do NOT set it, so default reset() is unchanged)
function richReset(){
  var D = reset();
  D.integrations = [
    {id:"icfg_1", slug:"neon", integrationId:"oac_neon", addedAt:1789900000000, scopes:["read","write"]},
    {id:"icfg_2", slug:"sentry", integrationId:"oac_sentry", addedAt:1790200000000, scopes:["read"]},
    {id:"icfg_3", slug:"slack", integrationId:"oac_slack", addedAt:1790600000000, scopes:["read","write"]}
  ];
  D.env = [
    {id:"env_1", key:"DATABASE_URL", type:"encrypted", target:["production","preview"], createdAt:1789000000000},
    {id:"env_2", key:"NEXT_PUBLIC_API_URL", type:"plain", target:["production","preview","development"], createdAt:1789500000000},
    {id:"env_3", key:"STRIPE_SECRET_KEY", type:"encrypted", target:["production"], createdAt:1790000000000},
    {id:"env_4", key:"SENTRY_DSN", type:"encrypted", target:["production","preview"], createdAt:1790500000000}
  ];
  D.aliases = [
    {uid:"al_1", alias:"acme.com", deploymentId:"dpl_w1", deployment:{url:"web-prod.vercel.app"}, createdAt:1791000000000},
    {uid:"al_2", alias:"docs.acme.com", deploymentId:"dpl_d1", deployment:{url:"docs-prod.vercel.app"}, createdAt:1791100000000},
    {uid:"al_3", alias:"api.acme.com", deploymentId:"dpl_a1", deployment:{url:"api-prod.vercel.app"}, createdAt:1791200000000}
  ];
  D.deployments = [
    {uid:"dpl_w1", name:"web", url:"web-prod.vercel.app", readyState:"READY", target:"production", createdAt:1792700000000, creator:{username:"lenderson"}},
    {uid:"dpl_w2", name:"web", url:"web-git-redesign.vercel.app", readyState:"READY", target:"preview", createdAt:1792650000000, creator:{username:"lenderson"}},
    {uid:"dpl_w3", name:"web", url:"web-git-navbar-fix.vercel.app", readyState:"ERROR", target:"preview", createdAt:1792600000000, creator:{username:"lenderson"}},
    {uid:"dpl_d1", name:"docs", url:"docs-prod.vercel.app", readyState:"READY", target:"production", createdAt:1792550000000, creator:{username:"lenderson"}},
    {uid:"dpl_d2", name:"docs", url:"docs-git-mdx-draft.vercel.app", readyState:"CANCELED", target:"preview", createdAt:1792500000000, creator:{username:"lenderson"}},
    {uid:"dpl_a1", name:"api", url:"api-prod.vercel.app", readyState:"READY", target:"production", createdAt:1792450000000, creator:{username:"lenderson"}},
    {uid:"dpl_a2", name:"api", url:"api-git-hotfix.vercel.app", readyState:"ERROR", target:"preview", createdAt:1792400000000, creator:{username:"lenderson"}},
    {uid:"dpl_a3", name:"api", url:"api-git-rate-limit.vercel.app", readyState:"READY", target:"preview", createdAt:1792350000000, creator:{username:"lenderson"}},
    {uid:"dpl_l1", name:"landing", url:"landing-prod.vercel.app", readyState:"READY", target:"production", createdAt:1792300000000, creator:{username:"lenderson"}},
    {uid:"dpl_l2", name:"landing", url:"landing-git-promo.vercel.app", readyState:"READY", target:"preview", createdAt:1792250000000, creator:{username:"lenderson"}},
    {uid:"dpl_l3", name:"landing", url:"landing-git-old-hero.vercel.app", readyState:"CANCELED", target:"preview", createdAt:1792200000000, creator:{username:"lenderson"}},
    {uid:"dpl_db1", name:"dashboard", url:"dashboard-git-charts.vercel.app", readyState:"READY", target:"preview", createdAt:1792150000000, creator:{username:"lenderson"}}
  ];
  D.projects = [
    {id:"prj_web", name:"web", framework:"nextjs", createdAt:1780000000000, updatedAt:1792700000000, link:{type:"github", org:"acme", repo:"web"}},
    {id:"prj_docs", name:"docs", framework:"astro", createdAt:1781000000000, updatedAt:1792550000000, link:{type:"github", org:"acme", repo:"docs"}},
    {id:"prj_api", name:"api", framework:"remix", createdAt:1782000000000, updatedAt:1792450000000, link:{type:"github", org:"acme", repo:"api"}},
    {id:"prj_landing", name:"landing", framework:"vite", createdAt:1783000000000, updatedAt:1792300000000, link:{type:"github", org:"acme", repo:"landing"}},
    {id:"prj_dash", name:"dashboard", framework:"sveltekit", createdAt:1784000000000, updatedAt:1792150000000, link:{type:"github", org:"acme", repo:"dashboard"}}
  ];
  D.domains = [
    {name:"acme.com", verified:true, serviceType:"external", createdAt:1770000000000, expiresAt:1800000000000},
    {name:"acme.dev", verified:true, serviceType:"external", createdAt:1772000000000, expiresAt:1802000000000},
    {name:"acme.io", verified:false, serviceType:"zeit.world", createdAt:1785000000000}
  ];
  D.stores = [
    {id:"store_blob_1", name:"assets", type:"blob", createdAt:1788000000000, size:524288000},
    {id:"store_pg_1", name:"acme-db", type:"postgres", createdAt:1789000000000, size:1073741824}
  ];
  D.edgeConfig = [
    {id:"ec_1", slug:"flags", createdAt:1788000000000, updatedAt:1792000000000, itemCount:24, sizeInBytes:4096},
    {id:"ec_2", slug:"maintenance", createdAt:1789000000000, updatedAt:1792100000000, itemCount:2, sizeInBytes:256}
  ];
  D.webhooks = [
    {id:"wh_1", url:"https://hooks.acme.com/deploy", events:["deployment.created","deployment.succeeded","deployment.error"], createdAt:1790000000000, projectIds:["prj_web","prj_api"]}
  ];
  return D;
}
let DB = (process.env.MOCK_RICH==="1"?richReset:reset)();

function send(res, code, obj, extraHeaders) {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    "content-type":"application/json",
    "access-control-allow-origin":"*",
    "access-control-allow-headers":"authorization,content-type",
    "access-control-allow-methods":"GET,DELETE,POST,OPTIONS"
  }, extraHeaders||{}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  const p = u.pathname;
  const method = req.method;
  if (method === "OPTIONS") return send(res, 204, "");
  if (p === "/__reset") { DB = (process.env.MOCK_RICH==="1"?richReset:reset)(); return send(res, 200, {reset:true}); }

  // auth check
  const auth = req.headers["authorization"] || "";
  if (!/^Bearer\s+\S+/.test(auth)) return send(res, 401, {error:{message:"missing token"}});

  // collect body
  let chunks = [];
  req.on("data", c => chunks.push(c));
  req.on("end", () => {
    let bodyObj = null;
    if (chunks.length) { try { bodyObj = JSON.parse(Buffer.concat(chunks).toString()); } catch(e){} }

    // ---- GETs ----
    if (method === "GET" && p === "/v2/user") return send(res, 200, DB.user);
    if (method === "GET" && p === "/v2/teams") return send(res, 200, DB.teams);
    if (method === "GET" && p === "/v1/integrations/configurations") return send(res, 200, DB.integrations);
    if (method === "GET" && p === "/v1/edge-config") return send(res, 200, DB.edgeConfig);
    if (method === "GET" && p === "/v1/webhooks") return send(res, 200, DB.webhooks);
    if (method === "GET" && p === "/v1/env") return send(res, 200, { data: DB.env, pagination:{count:DB.env.length, next:null, prev:null} });
    if (method === "GET" && p === "/v4/aliases") return send(res, 200, { aliases: DB.aliases, pagination:{count:DB.aliases.length, next:null, prev:null} });
    if (method === "GET" && p === "/v6/deployments") {
      // v5: artificial delay so progressive loading is observable (deployments is the slow category)
      const until = u.searchParams.get("until");
      const DELAY = parseInt(process.env.DEP_DELAY || "900", 10);
      if (!until) {
        return setTimeout(()=>send(res, 200, { deployments: DB.deployments.slice(0,2), pagination:{count:2, next:12345, prev:null} }), DELAY);
      } else {
        return setTimeout(()=>send(res, 200, { deployments: DB.deployments.slice(2), pagination:{count:DB.deployments.length-2, next:null, prev:null} }), 250);
      }
    }
    if (method === "GET" && p === "/v10/projects") return send(res, 200, { projects: DB.projects, pagination:{count:DB.projects.length, next:null, prev:null} });
    if (method === "GET" && p === "/v5/domains") return send(res, 200, { domains: DB.domains, pagination:{count:DB.domains.length, next:null, prev:null} });
    if (method === "GET" && p === "/v1/storage/stores") return send(res, 200, { stores: DB.stores });

    // ---- DELETEs ----
    let m;
    if (method === "DELETE" && (m = p.match(/^\/v1\/integrations\/configuration\/(.+)$/))) {
      DB.integrations = DB.integrations.filter(x => x.id !== dec(m[1])); return send(res, 200, {});
    }
    if (method === "DELETE" && (m = p.match(/^\/v1\/edge-config\/(.+)$/))) {
      DB.edgeConfig = DB.edgeConfig.filter(x => x.id !== dec(m[1])); return send(res, 200, {});
    }
    if (method === "DELETE" && (m = p.match(/^\/v1\/webhooks\/(.+)$/))) {
      DB.webhooks = DB.webhooks.filter(x => x.id !== dec(m[1])); return send(res, 204, "");
    }
    if (method === "DELETE" && p === "/v1/env") {
      const ids = (bodyObj && bodyObj.ids) || [];
      DB.env = DB.env.filter(x => ids.indexOf(x.id) < 0); return send(res, 200, {});
    }
    if (method === "DELETE" && (m = p.match(/^\/v2\/aliases\/(.+)$/))) {
      DB.aliases = DB.aliases.filter(x => x.uid !== dec(m[1])); return send(res, 200, {});
    }
    if (method === "DELETE" && (m = p.match(/^\/v13\/deployments\/(.+)$/))) {
      DB.deployments = DB.deployments.filter(x => x.uid !== dec(m[1])); return send(res, 200, {});
    }
    if (method === "DELETE" && (m = p.match(/^\/v9\/projects\/(.+)$/))) {
      // arm one 429 on first project delete
      if (DB.retryArmed) { DB.retryArmed = false; return send(res, 429, {error:{message:"rate limited"}}, {"retry-after":"1"}); }
      DB.projects = DB.projects.filter(x => x.id !== dec(m[1])); return send(res, 200, {});
    }
    if (method === "DELETE" && (m = p.match(/^\/v6\/domains\/(.+)$/))) {
      DB.domains = DB.domains.filter(x => x.name !== dec(m[1])); return send(res, 200, {});
    }
    if (method === "DELETE" && (m = p.match(/^\/storage\/stores\/blob\/(.+)$/))) {
      DB.stores = DB.stores.filter(x => x.id !== dec(m[1])); return send(res, 200, {});
    }

    return send(res, 404, {error:{message:"not found: "+method+" "+p}});
  });
});

function dec(s){ try { return decodeURIComponent(s); } catch(e){ return s; } }

// serve HTML too
const htmlServer = http.createServer((req, res) => {
  const file = process.env.HTML_FILE || path.join(__dirname, "..", "index.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(500); res.end("err"); return; }
    res.writeHead(200, {"content-type":"text/html"});
    res.end(data);
  });
});

const API_PORT = process.env.API_PORT || 4789;
const HTML_PORT = process.env.HTML_PORT || 4790;
server.listen(API_PORT, () => console.log("mock api on "+API_PORT));
htmlServer.listen(HTML_PORT, () => console.log("html on "+HTML_PORT));

module.exports = { reset: () => { DB = reset(); }, snapshot: () => DB };
