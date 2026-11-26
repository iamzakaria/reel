const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:process.env.REEL_BROWSER_CHANNEL||'chromium'});try{const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1});await page.setContent('<style>html,body{margin:0;background:transparent}</style>'+fs.readFileSync('build/icon.svg','utf8'));await page.screenshot({path:'build/icon.png',omitBackground:true});}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
