const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {parseListing,httpUrl}=require('../http-media.cjs');
const {startServer}=require('../server.cjs');
test('h5ai listings preserve encoded names and exclude parent/navigation',()=>{
 const entries=parseListing('<a href="https://example.com/">Help</a><div id="fallback"><a href="..">Parent Directory</a><a href="/TV/A%20%26%20B/">A &amp; B</a><a href="/TV/movie.mkv">movie.mkv</a><a href="/TV/poster.jpg">poster.jpg</a></div>','http://media.test/TV/');
 assert.equal(entries.length,3);assert.equal(entries[0].name,'A & B');assert.equal(entries[0].path,'http://media.test/TV/A%20%26%20B/');assert.equal(entries[0].directory,true);assert.throws(()=>httpUrl('file:///etc/passwd'));
});
test('HTTP portal connects, lists child folders, proxies ranges and subtitles',async()=>{
 const source=http.createServer((req,res)=>{
  if(req.url==='/'){res.end('<a href="/Series/">TV Series</a>');return;}
  if(req.url==='/Series/'){res.end('<div id="fallback"><a href="..">Parent</a><a href="/Series/test.webm">test.webm</a><a href="/Series/test.srt">test.srt</a></div>');return;}
  if(req.url.endsWith('.srt')){res.end('1\n00:00:00,000 --> 00:00:02,000\nHello');return;}
  if(req.url.endsWith('.webm')){res.writeHead(206,{'Content-Type':'video/webm','Content-Range':'bytes 2-4/10','Content-Length':'3'});res.end('234');return;}
  res.writeHead(404);res.end();
 });
 await new Promise(r=>source.listen(0,'127.0.0.1',r));const app=await startServer(0);const root=`http://127.0.0.1:${source.address().port}/`;
 try{
  const home=await fetch(app.url);const cookie=home.headers.get('set-cookie').split(';')[0];const headers={cookie,'Content-Type':'application/json'};
  const response=await fetch(app.url+'/api/connect',{method:'POST',headers,body:JSON.stringify({host:root})});const server=await response.json();assert.equal(response.status,200);assert.equal(server.type,'http');
  const url=(type,path)=>app.url+`/api/${type}?server=${server.id}&path=${encodeURIComponent(path)}`;
  const listed=await fetch(url('list',root+'Series/'),{headers});assert.equal((await listed.json()).files.length,2);
  const stream=await fetch(url('stream',root+'Series/test.webm'),{headers:{cookie,Range:'bytes=2-4'}});assert.equal(stream.status,206);assert.equal(stream.headers.get('content-range'),'bytes 2-4/10');assert.equal(await stream.text(),'234');
  const subtitle=await fetch(url('subtitle',root+'Series/test.srt'),{headers});assert.match(await subtitle.text(),/WEBVTT\n\n1\n00:00:00.000/);
  const denied=await fetch(url('stream',root+'unlisted.webm'),{headers});assert.equal(denied.status,500);
 }finally{source.closeAllConnections();source.close();app.server.closeAllConnections();app.server.close();}
});
