const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { startServer } = require('../server.cjs');
const {createSettings}=require('./settings.cjs');
let service, settings;
async function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 960, minWidth: 900, minHeight: 640, backgroundColor: '#101113', title: 'Reel', autoHideMenuBar: true, webPreferences: { preload:path.join(__dirname,'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin!==service.url) event.preventDefault(); });
  const allowFullscreen=(contents,permission,url)=>{
    if(contents!==win.webContents||permission!=='fullscreen')return false;
    try{return new URL(url).origin===service.url;}catch{return false;}
  };
  win.webContents.session.setPermissionRequestHandler((contents,permission,callback,details)=>callback(allowFullscreen(contents,permission,details.requestingUrl)));
  win.webContents.session.setPermissionCheckHandler((contents,permission,origin,details)=>allowFullscreen(contents,permission,details.requestingUrl||origin));
  await win.loadURL(service.url);
}
function trusted(event){return event.senderFrame && !event.senderFrame.parent && new URL(event.senderFrame.url).origin===service.url;}
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{const win=BrowserWindow.getAllWindows()[0];if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(async () => {
  settings=createSettings(path.join(app.getPath('userData'),'reel-settings.json'));
  service = await startServer(0);
  ipcMain.on('reel:load-state',(event)=>{event.returnValue=trusted(event)?settings.read():null;});
  ipcMain.handle('reel:save-state',(event,state)=>{if(!trusted(event))throw new Error('Untrusted window');return settings.write(state);});
  await createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
 }).catch(error=>{dialog.showErrorBox('Reel could not start',error.message);app.quit();});
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {service?.server.closeAllConnections();service?.server.close();});
