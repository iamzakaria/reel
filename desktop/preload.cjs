const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('reelDesktop',{
 loadState:()=>ipcRenderer.sendSync('reel:load-state'),
 saveState:state=>ipcRenderer.invoke('reel:save-state',state)
});
