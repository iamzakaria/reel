const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Writable } = require('node:stream');
const {httpUrl,listHttp,serveHttp}=require('./http-media.cjs');
const { Client } = require('basic-ftp');
const { remotePath, rangeFor, toVtt } = require('./media.cjs');
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.mp4':'video/mp4', '.m4v':'video/mp4', '.webm':'video/webm', '.mkv':'video/x-matroska', '.mp3':'audio/mpeg', '.vtt':'text/vtt' };
async function startServer(port = 4173) {
 const sessions = new Map(); const token = crypto.randomBytes(24).toString('hex');
 const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (status, body) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); };
  let client;
  try {
   if (url.pathname.startsWith('/api/')) {
    if (!req.headers.cookie?.split('; ').includes('reel=' + token)) return json(403,{error:'Session required'});
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(403,{error:'Origin rejected'});
    if (url.pathname === '/api/connect' && req.method === 'POST') {
     let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 8192) return json(413,{error:'Request too large'}); }
     const data = JSON.parse(body);
     if (/^https?:\/\//i.test(data.host||'')) {
      const root=httpUrl(data.host);const config={type:'http',root,allowed:new Set([root]),cache:new Map()};
      const files=await listHttp(config,root);if(!files.length)throw new Error('No media folders or supported files were found at this HTTP address');
      const id=crypto.createHash('sha256').update(root).digest('hex').slice(0,24);sessions.set(id,config);
      return json(200,{id,name:data.name||new URL(root).hostname,path:root,type:'http'});
     }
     if (!data.host || /[\s/\r\n]/.test(data.host)) throw new Error('Enter a valid FTP hostname or IP address');
     const config = {host:data.host,port:Number(data.port)||21,user:data.user||'anonymous',password:data.password||'anonymous@',secure:!!data.secure};
     client = new Client(15000); await client.access(config); await client.list(remotePath(data.path));
     const id = crypto.createHash('sha256').update(JSON.stringify([config.host,config.port,config.user,config.secure])).digest('hex').slice(0,24); sessions.set(id,config); return json(200,{id,name:data.name||data.host,path:remotePath(data.path)});
    }
    const config = sessions.get(url.searchParams.get('server')); if (!config) return json(404,{error:'Reconnect your FTP server to continue'});
    if(config.type==='http'){
     const target=httpUrl(url.searchParams.get('path')||config.root);
     if(url.pathname==='/api/list'){const cached=config.cache.get(target);return json(200,{files:cached&&Date.now()-cached.time<30000?cached.files:await listHttp(config,target)});}
     if(url.pathname==='/api/stream'||url.pathname==='/api/subtitle'){await serveHttp(config,target,req,res,url.pathname==='/api/subtitle');return;}
     return json(404,{error:'Not found'});
    }
    client = new Client(20000); await client.access(config);
    const target = remotePath(url.searchParams.get('path') || '/');
    if (url.pathname === '/api/list') { const files = await client.list(target); return json(200,{files:files.filter(f=>f.isDirectory||f.isFile).map(f=>({name:f.name,size:f.size,directory:f.isDirectory,path:path.posix.join(target,f.name)}))}); }
    if (url.pathname === '/api/subtitle') {
     let buffer = ''; const sink = new Writable({write(chunk,enc,cb){ buffer+=chunk.toString(); cb(buffer.length>2e6?new Error('Subtitle too large'):null); }});
     await client.downloadTo(sink,target); res.writeHead(200,{'Content-Type':'text/vtt; charset=utf-8'}); return res.end(toVtt(buffer));
    }
    if (url.pathname === '/api/stream') {
     const size = await client.size(target); let range;
     try { range=rangeFor(req.headers.range,size); } catch { res.writeHead(416,{'Content-Range':`bytes */${size}`}); return res.end(); }
     const {start,end,partial}=range; res.writeHead(partial?206:200,{'Content-Type':mime[path.extname(target).toLowerCase()]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(partial?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
     if(req.method==='HEAD') return res.end();
     let remaining=end-start+1;
     const sink = new Writable({write(chunk,enc,cb){const slice=chunk.subarray(0,remaining); remaining-=slice.length; res.write(slice,()=>{if(!remaining){res.end(); client.close();} cb();});}});
     res.on('close',()=>client.close()); await client.downloadTo(sink,target,start); if(!res.writableEnded)res.end(); return;
    }
    return json(404,{error:'Not found'});
   }
   if (url.pathname === '/assets/demo.webm') {
    const filePath=path.join(__dirname,'src/assets/demo.webm');
    const size=fs.statSync(filePath).size; let range;
    try {range=rangeFor(req.headers.range,size);} catch {res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
    const {start,end,partial}=range;
    res.writeHead(partial?206:200,{'Content-Type':'video/webm','Content-Length':end-start+1,'Accept-Ranges':'bytes',...(partial?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
    if(req.method==='HEAD')return res.end();
    const stream=fs.createReadStream(filePath,{start,end});res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);return;
   }
   const file = {'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[url.pathname]; if(!file){res.writeHead(404);return res.end();}
   res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Set-Cookie':`reel=${token}; HttpOnly; SameSite=Strict; Path=/`,'Content-Security-Policy':"default-src 'self'; img-src 'self' https://images.unsplash.com data:; media-src 'self' blob: https://storage.googleapis.com; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
   fs.createReadStream(path.join(__dirname,'src',file)).pipe(res);
  } catch(error) { if(!res.headersSent)json(500,{error:error.message}); else res.end(); } finally {client?.close();}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve)); return {server,url:`http://127.0.0.1:${server.address().port}`};
}
if(require.main===module)startServer().then(s=>console.log('Reel running at '+s.url));
module.exports={startServer};
