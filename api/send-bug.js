const { sendBugCommand } = require('../lib/whatsapp');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false,
            error: 'Method not allowed' 
        });
    }

    try {
        const { target, bugType } = req.body;

        // Validasi input
        if (!target || !bugType) {
            return res.status(400).json({
                success: false,
                message: 'Nomor target dan jenis bug harus diisi'
            });
        }

        // Validasi nomor telepon
        const phoneRegex = /^[0-9]+$/;
        const cleanTarget = target.replace(/\D/g, '');
        
        if (!phoneRegex.test(cleanTarget) || cleanTarget.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Format nomor telepon tidak valid'
            });
        }

        // Validasi bug type
        const validBugTypes = ['delay', 'blank', 'stuck'];
        if (!validBugTypes.includes(bugType)) {
            return res.status(400).json({
                success: false,
                message: 'Jenis bug tidak valid. Pilih: delay, blank, atau stuck'
            });
        }

        console.log(`📍 Processing bug request: ${bugType} to ${cleanTarget}`);
        
        // Kirim command ke WhatsApp
        const result = await sendBugCommand(cleanTarget, bugType);
        
        // Return response
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }

    } catch (error) {
        console.error('🚨 API Error:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server: ' + error.message
        });
    }
};
