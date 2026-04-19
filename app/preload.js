const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  openProjectDialog: () => ipcRenderer.invoke('fs:openProjectDialog'),
  saveDialog: (defaultPath) => ipcRenderer.invoke('fs:saveDialog', defaultPath),

  onMenuEvent: (channel, callback) => {
    const valid = ['menu:save', 'menu:open-project'];
    if (valid.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  sendRuntime: (data) => ipcRenderer.send('runtime:send', data),
  onRuntimeData: (callback) => ipcRenderer.on('runtime:data', (_e, data) => callback(data)),
  onRuntimeError: (callback) => ipcRenderer.on('runtime:error', (_e, data) => callback(data)),
  onRuntimeExit: (callback) => ipcRenderer.on('runtime:exit', (_e, code) => callback(code)),
  startRuntime: (runtimePath, sketchPath) => ipcRenderer.invoke('runtime:start', runtimePath, sketchPath),
  stopRuntime: () => ipcRenderer.invoke('runtime:stop'),
});
