const { makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

// Global variables untuk maintain state antar function calls
global.whatsappData = global.whatsappData || {
    socket: null,
    isConnecting: false,
    lastActivity: Date.now(),
    qrCode: null
};

async function initWhatsApp() {
    // Jika sudah connected, return socket yang ada
    if (global.whatsappData.socket && global.whatsappData.socket.user) {
        console.log('✅ Using existing WhatsApp connection');
        global.whatsappData.lastActivity = Date.now();
        return global.whatsappData.socket;
    }

    // Jika sedang connecting, tunggu
    if (global.whatsappData.isConnecting) {
        console.log('⏳ WhatsApp is connecting, waiting...');
        await delay(3000);
        return initWhatsApp();
    }

    global.whatsappData.isConnecting = true;
    console.log('🔄 Initializing WhatsApp connection...');

    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        
        const socket = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['WhatsApp Bug Bot', 'Chrome', '1.0.0'],
            logger: {
                level: 'silent' // Kurangi log untuk Vercel
            }
        });

        socket.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 QR Code received:');
                qrcode.generate(qr, { small: true });
                global.whatsappData.qrCode = qr;
            }
            
            if (connection === 'close') {
                console.log('❌ Connection closed');
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                
                // Reset state
                global.whatsappData.socket = null;
                global.whatsappData.isConnecting = false;
                
                if (shouldReconnect) {
                    console.log('🔄 Attempting reconnect...');
                    setTimeout(initWhatsApp, 5000);
                }
            } 
            else if (connection === 'open') {
                console.log('✅ WhatsApp Bot connected successfully!');
                global.whatsappData.socket = socket;
                global.whatsappData.isConnecting = false;
                global.whatsappData.qrCode = null;
                global.whatsappData.lastActivity = Date.now();
            }
        });

        socket.ev.on('creds.update', saveCreds);
        
        global.whatsappData.socket = socket;
        return socket;
        
    } catch (error) {
        console.error('❌ Error initializing WhatsApp:', error);
        global.whatsappData.isConnecting = false;
        global.whatsappData.socket = null;
        throw error;
    }
}

async function sendBugCommand(targetPhone, bugType) {
    try {
        console.log(`🔄 Sending ${bugType} bug to ${targetPhone}`);
        
        const socket = await initWhatsApp();
        
        // Tunggu maksimal 15 detik untuk connection
        let attempts = 0;
        while (!socket.user && attempts < 5) {
            console.log(`⏳ Waiting for connection... (${attempts + 1}/5)`);
            await delay(3000);
            attempts++;
        }

        if (!socket.user) {
            throw new Error('WhatsApp not connected. Please check QR code or try again.');
        }

        const botNumber = '62882000478539';
        
        // Format command berdasarkan bug type
        const commands = {
            delay: `!delay ${targetPhone}`,
            blank: `!blank ${targetPhone}`,
            stuck: `!stuck ${targetPhone}`
        };

        const command = commands[bugType];
        if (!command) {
            throw new Error('Invalid bug type');
        }

        console.log(`📤 Sending command: ${command}`);
        
        // Kirim message ke bot
        await socket.sendMessage(`${botNumber}@s.whatsapp.net`, { 
            text: command 
        });

        global.whatsappData.lastActivity = Date.now();
        
        return {
            success: true,
            message: `Bug ${bugType} berhasil dikirim ke ${targetPhone}`,
            data: {
                target: targetPhone,
                bugType: bugType,
                timestamp: new Date().toISOString()
            }
        };

    } catch (error) {
        console.error('❌ Error sending bug command:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

function getBotStatus() {
    if (global.whatsappData.socket && global.whatsappData.socket.user) {
        return {
            status: 'connected',
            lastActivity: global.whatsappData.lastActivity,
            user: global.whatsappData.socket.user.id
        };
    } else if (global.whatsappData.isConnecting) {
        return {
            status: 'connecting',
            qrCode: global.whatsappData.qrCode
        };
    } else {
        return {
            status: 'disconnected'
        };
    }
}

// Cleanup function untuk handle Vercel cold starts
function cleanup() {
    if (global.whatsappData.socket) {
        try {
            global.whatsappData.socket.end();
        } catch (error) {
            // Ignore cleanup errors
        }
    }
    global.whatsappData.socket = null;
    global.whatsappData.isConnecting = false;
}

module.exports = {
    sendBugCommand,
    getBotStatus,
    initWhatsApp,
    cleanup
};
