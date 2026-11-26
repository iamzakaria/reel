const $ = s => document.querySelector(s);
const photo = (id,w=500) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
const demo = [
 ['Interstellar','2014','Sci-Fi','photo-1462331940025-496dfbfc7564','Movies','4K'],
 ['Dune: Part Two','2024','Adventure','photo-1509316785289-025f5b846b35','Movies','4K'],
 ['The Last of Us','2023','Drama','photo-1448375240586-882707db888b','TV Shows','SERIES'],
 ['The Batman','2022','Crime','photo-1519608487953-e999c86e7455','Movies','4K'],
 ['Our Planet','2019','Nature','photo-1464822759023-fed622ff2c3b','Documentaries','SERIES'],
 ['Blade Runner 2049','2017','Sci-Fi','photo-1518837695005-2083093ee35b','Movies','4K'],
 ['Into the Wild','2007','Adventure','photo-1472396961693-142e6e269027','Movies','HD'],
 ['Blue Planet','2017','Nature','photo-1518467166778-b88f373ffec7','Documentaries','SERIES']
].map((d,i)=>({id:'demo-'+i,name:d[0],year:d[1],genre:d[2],image:photo(d[3]),category:d[4],quality:d[5],demo:true}));
function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
const initialState=window.reelDesktop?.loadState();
let saved = initialState?.saved||readLocal('reel-saved',[]);
let progress = initialState?.progress||readLocal('reel-progress',{});
let profiles = initialState?.profiles||readLocal('reel-profiles',[]);
function persistState(){
 localStorage.setItem('reel-saved',JSON.stringify(saved));localStorage.setItem('reel-progress',JSON.stringify(progress));localStorage.setItem('reel-profiles',JSON.stringify(profiles));
 window.reelDesktop?.saveState({saved,progress,profiles}).catch(()=>toast('Your changes could not be saved to this device.'));
}
let entries=demo, activeServer=null, currentPath='/', currentView='Discover', filter='All', currentMedia=null, listingVersion=0, subtitleUrl=null;
const serverList=[];
let folderHistory=[];
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3500);}
async function api(url,options){const response=await fetch(url,options);const body=await response.json();if(!response.ok)throw new Error(body.error||'Connection failed');return body;}
function endpoint(type,path,server=activeServer){return `/api/${type}?server=${encodeURIComponent(server.id)}&path=${encodeURIComponent(path)}`;}
function render(){
 let items=entries.filter(item=>(filter==='All'||item.category===filter)&&(currentView!=='My List'||saved.includes(item.id))&&item.name.toLowerCase().includes($('#search').value.toLowerCase()));
 if($('#sort').value!=='default')items=[...items].sort((a,b)=>a.name.localeCompare(b.name)*($('#sort').value==='az'?1:-1));
 $('#item-count').textContent=items.length;$('#saved-count').textContent=saved.length;
 $('#grid').innerHTML=items.length?items.map(item=>`<article class="card"><button class="poster" data-open="${escapeHtml(item.id)}" aria-label="${item.directory?'Open folder':'Play'} ${escapeHtml(item.name)}">${item.image?`<img src="${escapeHtml(item.image)}" alt="" loading="lazy">`:'<div class="folder-placeholder">▱</div>'}<span class="poster-tag">${item.directory?'FOLDER':escapeHtml(item.quality||'VIDEO')}</span>${item.demo?`<span class="poster-word">${escapeHtml(item.name)}</span>`:''}<span class="poster-play">${item.directory?'↗':'▶'}</span></button><div class="card-title"><h3>${escapeHtml(item.name)}</h3><button class="save ${saved.includes(item.id)?'saved':''}" data-save="${escapeHtml(item.id)}" aria-label="${saved.includes(item.id)?'Remove from':'Add to'} my list">${saved.includes(item.id)?'♥':'♡'}</button></div><p>${escapeHtml(item.year|| (item.directory?'Collection':'Direct stream'))} &nbsp;·&nbsp; ${escapeHtml(item.genre||'FTP library')}<span>${item.demo?'DEMO':''}</span></p></article>`).join(''):'<div class="empty">'+(currentView==='My List'?'Your list is waiting. Save a title with the heart button.':'No titles here. Try another folder or search.')+'</div>';
 document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openItem(entries.find(i=>i.id===el.dataset.open)));
 document.querySelectorAll('[data-save]').forEach(el=>el.onclick=()=>toggleSave(el.dataset.save));
 document.querySelectorAll('.poster img').forEach(img=>img.onerror=()=>{img.replaceWith(Object.assign(document.createElement('div'),{className:'folder-placeholder',textContent:'▱'}));});
 const resumed=entries.filter(i=>progress[i.id]>5&&!i.directory);$('#continue-section').hidden=!resumed.length;
 $('#continue-grid').innerHTML=resumed.slice(0,4).map(i=>`<button class="resume" data-resume="${escapeHtml(i.id)}">▶ &nbsp; ${escapeHtml(i.name)}<small>Resume at ${Math.floor(progress[i.id]/60)}:${String(Math.floor(progress[i.id]%60)).padStart(2,'0')}</small></button>`).join('');
 document.querySelectorAll('[data-resume]').forEach(el=>el.onclick=()=>openItem(entries.find(i=>i.id===el.dataset.resume)));
}
function toggleSave(id){saved=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];persistState();render();}
function setView(view){currentView=view;$('#page-label').textContent=view;$('#heading').textContent=view==='Discover'?'A good night starts here.':view==='My List'?'Worth coming back to.':view==='Movies'?'Make it a movie night.':'One more episode.';filter=['Movies','TV Shows'].includes(view)?view:'All';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));render();}
async function browse(folder,back=false){
 const version=++listingVersion;const server=activeServer;$('#grid').innerHTML='<div class="empty">Opening your collection…</div>';
 try{const {files}=await api(endpoint('list',folder,server));if(version!==listingVersion)return;if(!back&&folder!==currentPath)folderHistory.push(currentPath);currentPath=folder;
 entries=files.filter(f=>f.directory||/\.(mp4|m4v|webm|mkv|mov|mp3|ogg)$/i.test(f.name)).map(f=>({...f,id:server.id+':'+f.path,name:f.directory?f.name:f.name.replace(/\.[^.]+$/,''),category:f.category||'Movies',quality:f.directory?'FOLDER':f.name.split('.').pop().toUpperCase(),server}));
 $('#library-title').innerHTML='Your collection <span id="item-count"></span>';$('#library-subtitle').textContent=server.name+' · '+folder;$('#library-status').textContent='● Connected · '+server.name;$('#back').hidden=!folderHistory.length;render();
 for(const entry of entries.filter(e=>e.directory)){if(version!==listingVersion)break;try{const data=await api(endpoint('list',entry.path,server));const artwork=data.files.find(f=>/^(poster|folder|cover|fanart)\.(jpg|jpeg|png|webp)$/i.test(f.name))||data.files.find(f=>/\.(jpg|jpeg|png|webp)$/i.test(f.name));if(artwork)entry.image=endpoint('stream',artwork.path,server);if(version===listingVersion)render();}catch{}}
 }catch(e){if(version===listingVersion){$('#grid').innerHTML='<div class="empty">Unable to open this folder. Use Refresh to retry.</div>';toast(e.message);}}
}
async function openItem(item){
 if(item.directory){await browse(item.path);return;}
 currentMedia=item;$('#player-title').textContent=item.name;$('#player-error').textContent='';$('#subtitle-select').innerHTML='<option value="">Subtitles off</option>';$('#video').querySelectorAll('track').forEach(t=>t.remove());
 $('#video').src=item.demo?'/assets/demo.webm':endpoint('stream',item.path,item.server);
 $('#playback-status').textContent=item.demo?'Offline demo · 15-second motion sample (silent)':'Streaming directly from '+(item.server.type==='http'?'HTTP':'FTP');$('#player-dialog').showModal();
 $('#video').onloadedmetadata=()=>{if(progress[item.id]&&progress[item.id]<$('#video').duration-5)$('#video').currentTime=progress[item.id];};
 $('#video').play().catch(()=>{});
 if(!item.demo){try{const parent=item.server.type==='http'?new URL('.',item.path).href:item.path.slice(0,item.path.lastIndexOf('/'))||'/';const data=await api(endpoint('list',parent,item.server));if(currentMedia!==item)return;for(const f of data.files.filter(f=>/\.(srt|vtt)$/i.test(f.name))){const opt=document.createElement('option');opt.value=endpoint('subtitle',f.path,item.server);opt.textContent=f.name;$('#subtitle-select').append(opt);}}catch(e){toast('Subtitle discovery: '+e.message);}}
}
function setSubtitle(url){$('#video').querySelectorAll('track').forEach(t=>t.remove());if(!url)return;const track=document.createElement('track');track.kind='subtitles';track.label='Selected subtitles';track.srclang='en';track.src=url;track.default=true;track.onload=()=>track.track.mode='showing';track.onerror=()=>toast('Unable to load this subtitle file');$('#video').append(track);}
let fullscreenWasActive=false,fullscreenExitedAt=-Infinity;
async function toggleFullscreen(){
 if(!$('#player-dialog').open)return;
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await $('#player-stage').requestFullscreen();
 }catch(error){$('#player-error').textContent='Fullscreen could not start: '+error.message;}
}
$('#player-dialog').addEventListener('cancel',event=>{
 if(document.fullscreenElement||fullscreenWasActive||performance.now()-fullscreenExitedAt<500){
  event.preventDefault();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 }
});
$('#fullscreen-player').onclick=toggleFullscreen;
document.addEventListener('fullscreenchange',()=>{
 const active=!!document.fullscreenElement;
 if(fullscreenWasActive&&!active)fullscreenExitedAt=performance.now();
 fullscreenWasActive=active;
 const button=$('#fullscreen-player');button.textContent=active?'⛶ Exit fullscreen':'⛶ Fullscreen';button.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');button.setAttribute('aria-pressed',String(active));
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&document.fullscreenElement){event.preventDefault();event.stopPropagation();document.exitFullscreen().catch(()=>{});return;}
 if(event.key.toLowerCase()==='f'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&$('#player-dialog').open&&!event.target.closest('input,select,textarea,[contenteditable="true"]')){event.preventDefault();toggleFullscreen();}
});
$('#subtitle-select').onchange=e=>setSubtitle(e.target.value);
$('#subtitle-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;let text=(await file.text()).replace(/^\uFEFF/,'');if(!text.startsWith('WEBVTT'))text='WEBVTT\n\n'+text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2');if(subtitleUrl)URL.revokeObjectURL(subtitleUrl);subtitleUrl=URL.createObjectURL(new Blob([text],{type:'text/vtt'}));setSubtitle(subtitleUrl);toast('Subtitles loaded: '+file.name);e.target.value='';};
$('#video').onerror=async()=>{
 const item=currentMedia;
 if(!item || !$('#video').getAttribute('src'))return;
 const code=$('#video').error?.code;
 const messages={1:'Playback was interrupted. Open the title again to retry.',2:'The media connection failed during playback. Check your connection and retry.',3:'The player could not decode this file. Its codec may be unsupported, or the file may be damaged.',4:'The media could not be opened. The format may be unsupported or the source may be unavailable.'};
 let message=messages[code]||'Playback failed.';
 if(item.demo){message+=' The bundled demo could not be loaded. Restart Reel and try again.';}
 else {
  const protocol=item.server.type==='http'?'HTTP':'FTP';
  $('#player-error').textContent='Playback failed. Checking the '+protocol+' stream…';
  try{
   const response=await fetch(endpoint('stream',item.path,item.server),{headers:{Range:'bytes=0-0'},signal:AbortSignal.timeout(25000)});
   if(!response.ok){const body=await response.json().catch(()=>({}));message=protocol+' stream failed: '+(body.error||'HTTP '+response.status)+'.';}
   else{await response.body?.cancel();message+=' The '+protocol+' server is reachable and returned media bytes.';}
  }catch(error){message='The '+protocol+' media transfer failed: '+error.message+'. Check server availability and file access.';}
 }
 if(currentMedia===item)$('#player-error').textContent=message;
};
$('#video').ontimeupdate=()=>{if(currentMedia){progress[currentMedia.id]=$('#video').currentTime;}};
$('#video').onended=()=>{if(currentMedia)delete progress[currentMedia.id];};
function closePlayer(){ if(document.fullscreenElement)document.exitFullscreen().catch(()=>{}); $('#video').pause();$('#video').removeAttribute('src');$('#video').load();persistState();currentMedia=null;if(subtitleUrl){URL.revokeObjectURL(subtitleUrl);subtitleUrl=null;}render();}
$('#close-player').onclick=()=>$('#player-dialog').close();$('#player-dialog').addEventListener('close',closePlayer);
window.addEventListener('beforeunload',persistState);
setInterval(()=>{if(currentMedia)persistState();},5000);
function updateConnectionFields(){
 const form=$('#connect-form');const web=/^https?:\/\//i.test(form.elements.host.value);
 for(const name of ['port','user','password','path','secure'])form.elements[name].disabled=web;
 $('#connection-mode').textContent=web?'Web media server · HTTP / HTTPS':'FTP server · use the details supplied by your ISP';
}
function showConnection(profile){
 const form=$('#connect-form');form.reset();
 if(profile){for(const name of ['name','host','port','user','path'])form.elements[name].value=profile[name]|| (name==='path'?'/':'');form.elements.secure.checked=profile.secure;}
 $('#connect-error').textContent='';updateConnectionFields();$('#connect-dialog').showModal();
}
function renderServers(){
 document.querySelectorAll('.saved-server-row').forEach(el=>el.remove());
 for(const profile of profiles){
  const row=document.createElement('div');row.className='saved-server-row';
  const button=document.createElement('button');button.className='server';button.textContent=(serverList.some(s=>s.id===profile.id)?'● ':'○ ')+profile.name;
  button.title=profile.host;button.onclick=()=>{const connected=serverList.find(s=>s.id===profile.id);if(connected){activeServer=connected;folderHistory=[];currentPath=connected.path;setView('Discover');browse(connected.path);}else showConnection(profile);};
  const remove=document.createElement('button');remove.className='remove-server';remove.textContent='×';remove.setAttribute('aria-label','Remove '+profile.name);remove.onclick=()=>{profiles=profiles.filter(p=>p.id!==profile.id);persistState();renderServers();};
  row.append(button,remove);$('#servers').append(row);
 }
}
for(const id of ['add-server','add-small','connect-top'])$('#'+id).onclick=()=>showConnection();
$('[data-close="connect-dialog"]').onclick=()=>$('#connect-dialog').close();$('[data-close="about-dialog"]').onclick=()=>$('#about-dialog').close();$('#settings').onclick=()=>$('#about-dialog').showModal();
$('#connect-form').onsubmit=async e=>{
 e.preventDefault();const button=$('#connect-submit');button.disabled=true;button.textContent='Connecting…';$('#connect-error').textContent='';
 try{
  const form=new FormData(e.target);const data=Object.fromEntries(form);data.host=data.host.trim();data.secure=form.has('secure');
  const server=await api('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const old=serverList.findIndex(s=>s.id===server.id);if(old>=0)serverList.splice(old,1);serverList.push(server);
  const profile={id:server.id,name:server.name,host:data.host,port:Number(data.port)||21,user:data.user||'',path:data.path||'/',secure:data.secure,type:server.type||'ftp'};
  profiles=profiles.filter(p=>p.id!==server.id);profiles.push(profile);persistState();renderServers();
  activeServer=server;folderHistory=[];currentPath=server.path;
  $('#connect-dialog').close();e.target.elements.password.value='';setView('Discover');await browse(server.path);toast('Connected to '+server.name);
 }catch(error){$('#connect-error').textContent=error.message+' If this is an ISP server, connect to that ISP’s Wi-Fi and try again.';}
 finally{button.disabled=false;button.textContent='Connect server →';}
};
$('#demo-server').onclick=()=>{listingVersion++;activeServer=null;folderHistory=[];currentPath='/';entries=demo;$('#library-title').innerHTML='Explore your library <span id="item-count"></span>';$('#library-subtitle').textContent='A little bit of everything you love.';$('#library-status').textContent='● Demo library · Connect your FTP to get started';$('#back').hidden=true;setView('Discover');};
$('#back').onclick=()=>{const previous=folderHistory.pop();if(previous)browse(previous,true);};
$('#refresh').onclick=()=>activeServer?browse(currentPath):toast('Demo library is up to date');
$('#search').oninput=render;$('#sort').onchange=render;$('#layout').onclick=()=>$('#grid').classList.toggle('compact');
$('#play-featured').onclick=()=>openItem(demo[0]);$('#save-featured').onclick=()=>{toggleSave(demo[0].id);toast(saved.includes(demo[0].id)?'Added to My List':'Removed from My List');};
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(c=>c.classList.toggle('active',c===b));render();});
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();$('#search').focus();}});render();

$('#connect-form').elements.host.addEventListener('input',updateConnectionFields);
renderServers();
