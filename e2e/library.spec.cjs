const {test,expect}=require('@playwright/test');
test('browse, search, save, and connection form',async({page})=>{
 await page.goto('/');await expect(page.locator('.card')).toHaveCount(8);
 await page.getByRole('textbox',{name:'Search your library'}).fill('Dune');await expect(page.locator('.card')).toHaveCount(1);
 await page.getByRole('button',{name:'Add to my list',exact:true}).click();
 await page.getByRole('textbox',{name:'Search your library'}).fill('');
 await page.locator('[data-view="My List"]').click();await expect(page.locator('.card')).toHaveCount(1);
 await page.reload();await page.locator('[data-view="My List"]').click();await expect(page.locator('.card')).toHaveCount(1);
 await page.getByRole('button',{name:'＋ Add server',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('input[name="secure"]')).toBeChecked();
 await page.locator('[data-close="connect-dialog"]').click();await page.locator('[data-view="Discover"]').click();
 await page.screenshot({path:'test-results/reel-desktop.png',fullPage:true});
});
test('FTP browsing and adjacent subtitles via bridge contract',async({page})=>{
 await page.route('**/api/connect',r=>r.fulfill({json:{id:'test',name:'Test FTP',path:'/'}}));
 await page.route('**/api/list?**',r=>r.fulfill({json:{files:[{name:'Sample.mp4',path:'/Sample.mp4',size:100,directory:false},{name:'Sample.srt',path:'/Sample.srt',size:30,directory:false}]}}));
 await page.goto('/');await page.locator('#connect-top').click();await page.locator('[name="host"]').fill('127.0.0.1');await page.locator('#connect-submit').click();
 await expect(page.locator('.card')).toHaveCount(1);await page.locator('[data-open]').click();await expect(page.locator('#player-title')).toHaveText('Sample');await expect(page.locator('#subtitle-select option')).toHaveCount(2);
 await page.locator('#close-player').click();await expect(page.locator('#player-dialog')).not.toBeVisible();
});
test('playback error exposes FTP failure instead of blaming codecs',async({page})=>{
 await page.route('**/api/connect',r=>r.fulfill({json:{id:'test',name:'Test FTP',path:'/'}}));
 await page.route('**/api/list?**',r=>r.fulfill({json:{files:[{name:'Sample.mp4',path:'/Sample.mp4',size:100,directory:false}]}}));
 await page.route('**/api/stream?**',r=>r.fulfill({status:500,json:{error:'550 Permission denied'}}));
 await page.goto('/');await page.locator('#connect-top').click();await page.locator('[name="host"]').fill('127.0.0.1');await page.locator('#connect-submit').click();
 await expect(page.locator('.card')).toHaveCount(1);await page.locator('[data-open]').click();await expect(page.locator('#player-error')).toHaveText('FTP stream failed: 550 Permission denied.');
 await page.locator('#close-player').click();await expect(page.locator('#player-dialog')).not.toBeVisible();
});
test('HTTP URLs disable FTP settings and preserve folder navigation',async({page})=>{
 const root='http://172.16.50.12/';const folder=root+'TV%20Series/';
 await page.route('**/api/connect',r=>r.fulfill({json:{id:'web',name:'DhakaFlix',path:root,type:'http'}}));
 await page.route('**/api/list?**',r=>{const path=new URL(r.request().url()).searchParams.get('path');return r.fulfill({json:{files:path===root?[{name:'TV Series',path:folder,directory:true,category:'TV Shows'}]:[{name:'Episode.mp4',path:folder+'Episode.mp4',directory:false,category:'TV Shows'}]}});});
 await page.goto('/');await page.locator('#connect-top').click();await page.locator('[name="host"]').fill(root);await expect(page.locator('[name="port"]')).toBeDisabled();await page.locator('#connect-submit').click();
 await page.getByRole('button',{name:'Open folder TV Series',exact:true}).click();await expect(page.locator('.card h3')).toHaveText('Episode');await page.locator('#back').click();await expect(page.locator('.card h3')).toHaveText('TV Series');await expect(page.locator('#back')).toBeHidden();
});
