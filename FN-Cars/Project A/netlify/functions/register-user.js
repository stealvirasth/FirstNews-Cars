// netlify/functions/register-user.js
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const userData = JSON.parse(event.body);
        
        // ตรวจสอบข้อมูลที่จำเป็น
        if (!userData.userId || !userData.displayName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing required fields: userId, displayName' 
                })
            };
        }
        
        // TODO: บันทึกผู้ใช้ใหม่ลง database
        console.log('📝 New user registration:', userData);
        
        // ส่งอีเมลแจ้ง admin (ตัวอย่าง)
        // await sendEmailToAdmin(userData);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'User registered successfully',
                userId: userData.userId,
                requiresApproval: true // ต้องรอ admin อนุมัติ
            })
        };
        
    } catch (error) {
        console.error('Error registering user:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to register user' })
        };
    }
};