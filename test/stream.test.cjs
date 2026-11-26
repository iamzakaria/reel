const {test}=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {startServer}=require('../server.cjs');
test('real FTP bridge lists files and streams seek ranges',async()=>{
 const bytes=Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
 const sockets=new Set();let passive;
 const ftp=net.createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.write('220 Test FTP\r\n');let pending='',offset=0,dataSocket,dataReady;
  socket.on('data',chunk=>{pending+=chunk;let i;while((i=pending.indexOf('\r\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+2);const [cmd,...parts]=line.split(' ');const arg=parts.join(' ');
   if(cmd==='USER')socket.write('331 Password\r\n');
   else if(cmd==='PASS')socket.write('230 Logged in\r\n');
   else if(cmd==='FEAT')socket.write('211 End\r\n');
   else if(cmd==='PWD')socket.write('257 "/"\r\n');
   else if(cmd==='TYPE'||cmd==='OPTS')socket.write('200 OK\r\n');
   else if(cmd==='EPSV'){passive=net.createServer(s=>{dataSocket=s;sockets.add(s);s.on('close',()=>sockets.delete(s));dataReady?.();});passive.listen(0,'127.0.0.1',()=>socket.write(`229 Entering Extended Passive Mode (|||${passive.address().port}|)\r\n`));}
   else if(cmd==='LIST'||cmd==='MLSD'||cmd==='RETR'){
    socket.write('150 Opening data\r\n');const send=()=>{dataSocket.end(cmd==='RETR'?bytes.subarray(offset):'-rw-r--r-- 1 ftp ftp 36 Jan 01 2026 movie.mp4\r\n');offset=0;dataSocket=null;passive.close();socket.write('226 Transfer complete\r\n');};if(dataSocket)send();else dataReady=send;
   }else if(cmd==='SIZE')socket.write('213 '+bytes.length+'\r\n');
   else if(cmd==='REST'){offset=Number(arg);socket.write('350 Restart accepted\r\n');}
   else if(cmd==='QUIT')socket.end('221 Bye\r\n');
   else socket.write('502 Unsupported\r\n');
  }});
 });
 await new Promise(r=>ftp.listen(0,'127.0.0.1',r));const service=await startServer(0);
 try{
  const root=await fetch(service.url);const cookie=root.headers.get('set-cookie').split(';')[0];const headers={cookie,'Content-Type':'application/json'};
  const denied=await fetch(service.url+'/api/list');assert.equal(denied.status,403);
  const conn=await fetch(service.url+'/api/connect',{method:'POST',headers,body:JSON.stringify({host:'127.0.0.1',port:ftp.address().port,path:'/'})});const info=await conn.json();assert.equal(conn.status,200,JSON.stringify(info));
  const list=await fetch(service.url+`/api/list?server=${info.id}&path=/`,{headers});assert.equal((await list.json()).files[0].name,'movie.mp4');
  const media=await fetch(service.url+`/api/stream?server=${info.id}&path=/movie.mp4`,{headers:{cookie,range:'bytes=10-19'}});assert.equal(media.status,206);assert.equal(media.headers.get('content-range'),'bytes 10-19/36');assert.equal(await media.text(),'abcdefghij');
 }finally{for(const s of sockets)s.destroy();passive?.close();ftp.close();service.server.closeAllConnections();await new Promise(r=>service.server.close(r));}
});
