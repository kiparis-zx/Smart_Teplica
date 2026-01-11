const { contextBridge, ipcRenderer } = require('electron');

// Безопасное API для рендерера
contextBridge.exposeInMainWorld('electronAPI', {
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    platform: process.platform,
    versions: process.versions
});

// Отключаем контекстное меню
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Отключаем перетаскивание
window.addEventListener('dragover', (e) => {
    e.preventDefault();
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
});
