const fs = require('node:fs');
const path = require('node:path');
function cleanState(value = {}) {
 const text = (v, max = 2048) => typeof v === 'string' ? v.slice(0,max) : '';
 const saved = Array.isArray(value.saved) ? [...new Set(value.saved.filter(v=>typeof v==='string').map(v=>v.slice(0,4096)))].slice(0,5000) : [];
 const progress = Object.fromEntries(Object.entries(value.progress || {}).filter(([key,v])=>key.length<=4096&&Number.isFinite(v)&&v>=0).slice(0,5000));
 const profiles = (Array.isArray(value.profiles)?value.profiles:[]).slice(0,100).map(p=>({id:text(p.id,64),name:text(p.name,120),host:text(p.host),port:Number(p.port)||21,user:text(p.user,256),path:text(p.path)||'/',secure:!!p.secure,type:p.type==='http'?'http':'ftp'})).filter(p=>p.id&&p.host);
 return {saved,progress,profiles};
}
function createSettings(file) {
 let state = cleanState();
 try { state = cleanState(JSON.parse(fs.readFileSync(file,'utf8'))); } catch(error) { if(error.code!=='ENOENT')console.warn('Could not load Reel settings:',error.message); }
 return {read:()=>state,write(value){
  const next=cleanState(value);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});
  fs.renameSync(file+'.tmp',file);state=next;
  return true;
 }};
}
module.exports={cleanState,createSettings};
