const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createSettings}=require('../desktop/settings.cjs');
test('desktop settings survive restart without saving credentials',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reel-settings-'));const file=path.join(dir,'settings.json');
 try{
  createSettings(file).write({saved:['demo-1'],progress:{'demo-1':8.5},profiles:[{id:'server1',host:'192.168.1.2',name:'My ISP',password:'must-not-be-saved',user:'viewer',path:'/Movies'}]});
  const state=createSettings(file).read();assert.deepEqual(state.saved,['demo-1']);assert.equal(state.progress['demo-1'],8.5);assert.equal(state.profiles[0].host,'192.168.1.2');assert.equal(state.profiles[0].password,undefined);assert.equal(fs.readFileSync(file,'utf8').includes('must-not-be-saved'),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
