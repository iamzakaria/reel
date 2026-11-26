const {load}=require('cheerio');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {toVtt}=require('./media.cjs');
const supported=/\.(mp4|m4v|mkv|webm|mov|avi|mp3|ogg|jpg|jpeg|png|webp|srt|vtt)$/i;
function httpUrl(value){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Enter an HTTP or HTTPS address without embedded credentials');url.hash='';return url.href;}
function parseListing(html,base){
 const $=load(html);const files=new Map();const current=new URL(base);
 const anchors=$('#fallback a').length?$('#fallback a'):$('a[href]');
 anchors.each((_,a)=>{
  const raw=$(a).attr('href');if(!raw||raw.startsWith('#')||raw.startsWith('?')||raw==='..'||raw==='../')return;
  let target;try{target=new URL(httpUrl(new URL(raw,base).href));}catch{return;}
  if(target.search||target.href===current.href||target.pathname.startsWith('/_h5ai/'))return;
  const directory=target.pathname.endsWith('/');
  if(!directory&&!supported.test(target.pathname))return;
  // A directory index should list descendants, not its parent or unrelated navigation.
  if(target.origin===current.origin&&current.pathname!=='/'&&!target.pathname.startsWith(current.pathname))return;
  let fallback;try{fallback=decodeURIComponent(target.pathname.split('/').filter(Boolean).pop()||target.hostname);}catch{fallback=target.pathname;}
  const name=$(a).text().trim()||fallback;
  files.set(target.href,{name,path:target.href,directory,size:0,category:/documentar/i.test(target.pathname)?'Documentaries':/series|tv-show/i.test(target.pathname)?'TV Shows':'Movies'});
 });
 return [...files.values()];
}
async function request(url,options={}){
 let target=httpUrl(url);const controller=options.controller||new AbortController();
 const timer=setTimeout(()=>controller.abort(new Error('HTTP server timed out')),20000);
 try{
  for(let n=0;n<5;n++){
   const response=await fetch(target,{...options,controller:undefined,signal:controller.signal,redirect:'manual'});
   if([301,302,303,307,308].includes(response.status)){
    const next=httpUrl(new URL(response.headers.get('location'),target).href);await response.body?.cancel();
    if(new URL(next).origin!==new URL(target).origin)throw new Error('Cross-server redirect not supported; connect to the destination URL directly');target=next;continue;
   }
   if(!response.ok&&response.status!==416){await response.body?.cancel();throw new Error(`HTTP server returned ${response.status} ${response.statusText}`);}
   return {response,url:target};
  }
  throw new Error('Too many HTTP redirects');
 }finally{clearTimeout(timer);}
}
async function limitedText(response,limit){
 let size=0;const chunks=[];const reader=response.body.getReader();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;reader.cancel();},20000);
 try{while(true){const {done,value}=await reader.read();if(done){if(timedOut)throw new Error('HTTP response timed out');break;}size+=value.length;if(size>limit){await reader.cancel();throw new Error('Server response is too large');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks).toString('utf8');}finally{clearTimeout(timer);reader.releaseLock();}
}
async function listHttp(config,target){
 if(!config.allowed.has(target))throw new Error('Open this folder through the connected server');
 const {response,url}=await request(target);
 if(response.status!==200)throw new Error('Unable to read directory');
 const files=parseListing(await limitedText(response,8e6),url);
 config.allowed.add(url);for(const file of files)config.allowed.add(file.path);
 config.cache.set(target,{files,time:Date.now()});return files;
}
async function serveHttp(config,target,req,res,subtitle=false){
 if(!config.allowed.has(target))throw new Error('Open this file through the connected server');
 const controller=new AbortController();res.on('close',()=>controller.abort());
 const headers=req.headers.range?{Range:req.headers.range}:{};
 const {response}=await request(target,{controller,headers,method:req.method==='HEAD'?'HEAD':'GET'});
 if(subtitle){const text=await limitedText(response,2e6);res.writeHead(200,{'Content-Type':'text/vtt; charset=utf-8'});res.end(toVtt(text));return;}
 const forwarded={'Content-Type':response.headers.get('content-type')||'application/octet-stream'};
 for(const name of ['content-length','content-range','accept-ranges'])if(response.headers.has(name))forwarded[name]=response.headers.get(name);
 res.writeHead(response.status,forwarded);
 if(req.method==='HEAD'||!response.body){res.end();return;}
 await pipeline(Readable.fromWeb(response.body),res);
}
module.exports={httpUrl,parseListing,listHttp,serveHttp};
