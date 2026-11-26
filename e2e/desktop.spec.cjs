const {test,expect}=require('@playwright/test');
const {_electron}=require('playwright');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
function launchDesktop(directory=fs.mkdtempSync(path.join(os.tmpdir(),'reel-desktop-test-'))){return _electron.launch({...(process.env.REEL_EXECUTABLE?{executablePath:process.env.REEL_EXECUTABLE}:{}),args:[...(process.env.REEL_EXECUTABLE?[]:['.']),'--user-data-dir='+directory]});}
test('desktop window starts with isolated renderer',async()=>{
 test.setTimeout(180000);
 const app=await launchDesktop();
 try{const window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');await expect(window.locator('h1')).toHaveText('A good night starts here.');expect(await window.evaluate(()=>typeof require)).toBe('undefined');}finally{await app.close();}
});
test('bundled demo plays and seeks without internet',async()=>{
 test.setTimeout(180000);
 const app=await launchDesktop();
 try{
  const window=await app.firstWindow();
  await window.route(/^https:\/\//,route=>route.abort());
  await window.waitForLoadState('domcontentloaded');
  await window.locator('#play-featured').click();
  const video=window.locator('#video');
  await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(0.2);
  await video.evaluate(v=>{v.currentTime=10;});
  await expect.poll(()=>video.evaluate(v=>!v.seeking&&v.currentTime>=10&&v.readyState>=2)).toBe(true);
  await expect(window.locator('#player-error')).toBeEmpty();
  await window.locator('#close-player').click();
 }finally{await app.close();}
});

test('standalone app remembers server profiles and favorites after restart',async()=>{
 test.setTimeout(180000);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reel-persistence-'));
 let app=await launchDesktop(dir);
 try{
  let window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');
  if(process.env.REEL_EXECUTABLE)expect(await app.evaluate(({app})=>app.isPackaged)).toBe(true);
  await window.route('**/api/connect',r=>r.fulfill({json:{id:'isp-test',name:'My ISP',path:'/',type:'ftp'}}));
  await window.route('**/api/list?**',r=>r.fulfill({json:{files:[]}}));
  await window.locator('[data-save="demo-1"]').click();
  await window.locator('#connect-top').click();await window.locator('[name="name"]').fill('My ISP');await window.locator('[name="host"]').fill('192.168.1.2');await window.locator('[name="password"]').fill('temporary-test-password');await window.locator('#connect-submit').click();
  await expect(window.locator('.saved-server-row .server')).toHaveText('● My ISP');
  const dataPath=await app.evaluate(({app})=>app.getPath('userData'));
  await expect.poll(()=>{try{return JSON.parse(fs.readFileSync(path.join(dataPath,'reel-settings.json'),'utf8')).profiles.length;}catch{return 0;}}).toBe(1);
  await app.close();app=await launchDesktop(dir);window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');
  await expect(window.locator('[data-save="demo-1"]')).toHaveClass(/saved/);
  await expect(window.locator('.saved-server-row .server')).toHaveText('○ My ISP');
  await window.locator('.saved-server-row .server').click();await expect(window.locator('[name="host"]')).toHaveValue('192.168.1.2');await expect(window.locator('[name="password"]')).toHaveValue('');
  await window.locator('[data-close="connect-dialog"]').click();await window.getByRole('button',{name:'Remove My ISP',exact:true}).click();await expect(window.locator('.saved-server-row')).toHaveCount(0);
 }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('player enters and exits fullscreen with controls and shortcuts',async()=>{
 test.setTimeout(180000);
 const app=await launchDesktop();
 try{
  const window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');await window.locator('#play-featured').click();
  await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.fullscreenTransitions=0;win.on('enter-full-screen',()=>win.fullscreenTransitions++);win.on('leave-full-screen',()=>win.fullscreenTransitions++);});
  const settled=async count=>expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].fullscreenTransitions),{timeout:15000}).toBe(count);
  await window.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await settled(1);
  await expect.poll(()=>window.evaluate(()=>document.fullscreenElement?.id)).toBe('player-stage');
  await expect(window.locator('#subtitle-select')).toBeVisible();
  await window.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await settled(2);
  await expect.poll(()=>window.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await window.keyboard.press('f');await settled(3);await expect.poll(()=>window.evaluate(()=>document.fullscreenElement?.id)).toBe('player-stage');
  await window.keyboard.press('Escape');await settled(4);await expect.poll(()=>window.evaluate(()=>document.fullscreenElement===null)).toBe(true);await expect(window.locator('#player-dialog')).toBeVisible();
  await window.locator('#video').dblclick();await settled(5);await expect.poll(()=>window.evaluate(()=>document.fullscreenElement?.id)).toBe('video');
  await window.keyboard.press('f');await settled(6);await expect.poll(()=>window.evaluate(()=>document.fullscreenElement===null)).toBe(true);
  await window.locator('#close-player').click();await expect(window.locator('#player-dialog')).not.toBeVisible();
 }finally{await app.close();}
});
