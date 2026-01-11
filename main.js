const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;
let serverPort;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        title: 'Управление теплицей',
        show: false,
        autoHideMenuBar: false
    });

    // Запускаем сервер как дочерний процесс
    serverProcess = spawn('node', ['teplica.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
    });

    // Получаем порт от сервера
    serverProcess.stdout.on('data', (data) => {
        const message = data.toString();
        console.log('Server:', message);
        
        // Ищем порт в сообщении
        const portMatch = message.match(/Сервер запущен на порту (\d+)/);
        if (portMatch) {
            serverPort = portMatch[1];
            console.log('Server port detected:', serverPort);
            
            // Загружаем интерфейс с правильным портом
            mainWindow.loadURL(`http://localhost:${serverPort}`);
        }
    });

    serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
    });

    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
        if (mainWindow) {
            mainWindow.close();
        }
    });

    // Fallback: если порт не определен, пробуем стандартный порт
    setTimeout(() => {
        if (!serverPort) {
            serverPort = 3000;
            console.log('Using fallback port:', serverPort);
            mainWindow.loadURL(`http://localhost:${serverPort}`);
        }
    }, 2000);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (serverProcess) {
            serverProcess.kill();
        }
    });
}

function createMenu() {
    const template = [
        {
            label: 'Файл',
            submenu: [
                {
                    label: 'Выход',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        if (serverProcess) {
                            serverProcess.kill();
                        }
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Вид',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' }
            ]
        },
        {
            label: 'Разработчик',
            submenu: [
                { role: 'toggledevtools' },
                { type: 'separator' },
                { role: 'toggleDevTools' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();
    createMenu();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (serverProcess) {
            serverProcess.kill();
        }
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

// Обработка событий от рендерера
ipcMain.handle('show-message-box', async (event, options) => {
    const { message, type = 'info', buttons = ['OK'] } = options;
    const result = await dialog.showMessageBox(mainWindow, {
        message,
        type,
        buttons
    });
    return result;
});

ipcMain.handle('open-dev-tools', () => {
    mainWindow.webContents.openDevTools();
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});
