const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const isElectron = process.versions && process.versions.electron;

// Настройка COM порта (измените на ваш порт)
const port = new SerialPort({
    path: 'COM3', // Измените на ваш COM порт
    baudRate: 9600
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

// Обслуживание статических файлов
app.use('/static', express.static('static'));
app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
    if (isElectron) {
        res.sendFile(__dirname + '/templates/index.html');
    } else {
        res.sendFile(__dirname + '/templates/index.html');
    }
});

// Данные с датчиков
let sensorData = {
    humidity: 0,
    light: 0,
    temperature: 0,
    pumpStatus: 'off',
    servoStatus: 'closed',
    ledStatus: 'off',
    mode: 'auto'
};

// Парсинг данных с Arduino
parser.on('data', (data) => {
    console.log('Arduino:', data);
    
    // Парсинг влажности почвы
    if (data.includes('Влажность почвы:')) {
        const match = data.match(/Влажность почвы: (\d+\.?\d*)%/);
        if (match) sensorData.humidity = parseFloat(match[1]);
    }
    
    // Парсинг освещенности
    if (data.includes('Освещенность:')) {
        const match = data.match(/Освещенность: (\d+)/);
        if (match) sensorData.light = parseInt(match[1]);
    }
    
    // Парсинг температуры
    if (data.includes('Температура:')) {
        const match = data.match(/Температура: (\d+\.?\d*)/);
        if (match) sensorData.temperature = parseFloat(match[1]);
    }
    
    // Парсинг состояния насоса
    if (data.includes('Насос ВКЛЮЧЕН')) {
        sensorData.pumpStatus = 'on';
    } else if (data.includes('Насос ВЫКЛЮЧЕН')) {
        sensorData.pumpStatus = 'off';
    }
    
    // Парсинг состояния светодиода
    if (data.includes('Светодиод ВКЛЮЧЕН')) {
        sensorData.ledStatus = 'on';
    } else if (data.includes('Светодиод ВЫКЛЮЧЕН')) {
        sensorData.ledStatus = 'off';
    }
    
    // Парсинг режима работы
    if (data.includes('Режим: Автоматический')) {
        sensorData.mode = 'auto';
    } else if (data.includes('Режим: Ручной')) {
        sensorData.mode = 'manual';
    }
    
    // Отправка данных на веб-интерфейс
    io.emit('sensorData', sensorData);
});

// Обработка команд от веб-интерфейса
io.on('connection', (socket) => {
    console.log('Пользователь подключен');
    
    // Отправка текущих данных при подключении
    socket.emit('sensorData', sensorData);
    
    // Обработка команд
    socket.on('command', (command) => {
        console.log('Команда:', command);
        
        // Проверка на команду выключения сервера
        if (command === 'shutdown') {
            console.log('Выключение сервера...');
            socket.emit('serverStatus', { status: 'shutting_down', message: 'Сервер выключается...' });
            
            // Закрываем соединение с Arduino
            port.close(() => {
                console.log('Соединение с Arduino закрыто');
            });
            
            // Если запущено в Electron, закрываем приложение
            if (isElectron) {
                setTimeout(() => {
                    if (process.electron) {
                        process.electron.app.quit();
                    } else {
                        process.exit(0);
                    }
                }, 1000);
            } else {
                // Выключаем сервер через 1 секунду
                setTimeout(() => {
                    process.exit(0);
                }, 1000);
            }
            return;
        }
        
        port.write(command + '\n');
    });
    
    socket.on('disconnect', () => {
        console.log('Пользователь отключен');
    });
});

// API эндпоинт для получения данных
app.get('/api/sensors', (req, res) => {
    res.json(sensorData);
});

// API эндпоинт для отправки команд
app.post('/api/command', (req, res) => {
    const command = req.body.command;
    if (command) {
        port.write(command + '\n');
        res.json({ success: true, command: command });
    } else {
        res.status(400).json({ success: false, error: 'Команда не указана' });
    }
});

// Запуск сервера
if (isElectron) {
    // В Electron сервер запускается на случайном порту
    const PORT = 0; // Система выберет свободный порт
    server.listen(PORT, () => {
        const actualPort = server.address().port;
        console.log(`Сервер запущен на порту ${actualPort}`);
        
        // Отправляем порт в главный процесс Electron
        if (process.send) {
            process.send({ port: actualPort });
        }
    });
} else {
    // Обычный запуск в браузере
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
        console.log('Откройте http://localhost:3000 в браузере');
    });
}

// Обработка ошибок порта
port.on('error', (err) => {
    console.error('Ошибка Serial Port:', err.message);
});