// netlify/functions/log-login.js
exports.handler = async (event) => {
    // ตรวจสอบ method
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const loginData = JSON.parse(event.body);
        
        // เพิ่ม timestamp จาก server เพื่อความถูกต้อง
        loginData.serverTimestamp = new Date().toISOString();
        loginData.ip = event.headers['client-ip'] || event.headers['x-forwarded-for'];
        
        // TODO: บันทึกลง database (MongoDB, PostgreSQL, etc.)
        console.log('📝 Login log:', loginData);
        
        // ตัวอย่างการบันทึกไฟล์ (ถ้ายังไม่มี database)
        const fs = require('fs');
        const logEntry = JSON.stringify(loginData) + '\n';
        fs.appendFileSync('/tmp/login-logs.txt', logEntry);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                message: 'Login logged successfully',
                timestamp: loginData.serverTimestamp
            })
        };
        
    } catch (error) {
        console.error('Error logging login:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Failed to log login'
            })
        };
    }
};