// netlify/functions/get-records.js (โปรเจกต์ B) - แก้ไขให้ดึง pictureUrl จาก JSONBin แทน Hard-coded
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        // ✅ Bin เก่า (อ่านอย่างเดียว เก็บข้อมูลเดิม)
        const OLD_BIN_ID = '69004526d0ea881f40c15ac0';
        const NEW_BIN_ID = '69d38562aaba882197cbd71e';
        const USER_BIN_ID = '699fc030d0ea881f40da5eef';  // ✅ เพิ่ม: Bin ที่เก็บข้อมูลผู้ใช้
        const MASTER_KEY = '$2a$10$rrkK3fr7FCHp7uQlGy201uITw7TgSBKmb0xf0R2EeDod9V405xU6m';

        // 1. ดึงข้อมูลผู้ใช้ (สำหรับ pictureUrl ล่าสุด)
        let userMap = {};
        try {
            const userResponse = await fetch(`https://api.jsonbin.io/v3/b/${USER_BIN_ID}/latest`, {
                headers: { 'X-Master-Key': MASTER_KEY, 'X-Bin-Meta': 'false' }
            });
            if (userResponse.ok) {
                const userData = await userResponse.json();
                userMap = userData.record || userData;
                console.log(`📦 โหลดข้อมูลผู้ใช้ ${Object.keys(userMap).length} คน`);
            }
        } catch (err) {
            console.warn('⚠️ ดึงข้อมูลผู้ใช้ไม่สำเร็จ:', err.message);
        }

        // 2. ดึงข้อมูลจาก Bin เก่า
        let oldRecords = [];
        try {
            const oldResponse = await fetch(`https://api.jsonbin.io/v3/b/${OLD_BIN_ID}/latest`, {
                headers: { 'X-Master-Key': MASTER_KEY, 'X-Bin-Meta': 'false' }
            });
            
            if (oldResponse.ok) {
                const oldData = await oldResponse.json();
                if (oldData.record && oldData.record.records) {
                    oldRecords = oldData.record.records;
                } else if (oldData.records) {
                    oldRecords = oldData.records;
                } else if (Array.isArray(oldData)) {
                    oldRecords = oldData;
                } else if (oldData.record && Array.isArray(oldData.record)) {
                    oldRecords = oldData.record;
                }
                console.log(`📦 Bin เก่า: ${oldRecords.length} รายการ`);
            }
        } catch (err) {
            console.warn('⚠️ ดึง Bin เก่าไม่สำเร็จ:', err.message);
        }

        // 3. ดึงข้อมูลจาก Bin ใหม่
        let newRecords = [];
        try {
            const newResponse = await fetch(`https://api.jsonbin.io/v3/b/${NEW_BIN_ID}/latest`, {
                headers: { 'X-Master-Key': MASTER_KEY, 'X-Bin-Meta': 'false' }
            });
            
            if (newResponse.ok) {
                const newData = await newResponse.json();
                if (newData.record && newData.record.records) {
                    newRecords = newData.record.records;
                } else if (newData.records) {
                    newRecords = newData.records;
                } else if (Array.isArray(newData)) {
                    newRecords = newData;
                }
                console.log(`📦 Bin ใหม่: ${newRecords.length} รายการ`);
            }
        } catch (err) {
            console.warn('⚠️ ดึง Bin ใหม่ไม่สำเร็จ:', err.message);
        }

        // 4. รวมข้อมูลทั้งหมด
        const allRecords = [...oldRecords, ...newRecords];
        console.log(`✅ รวมทั้งหมด: ${allRecords.length} รายการ (เก่า ${oldRecords.length} + ใหม่ ${newRecords.length})`);

        // 5. แปลงข้อมูล พร้อมเพิ่ม pictureUrl จาก userMap (ข้อมูลล่าสุด)
        const formattedRecords = allRecords.map(record => {
            // ✅ ดึง pictureUrl จาก userMap (อัปเดตล่าสุด)
            let pictureUrl = null;
            
            if (record.userId && userMap[record.userId] && userMap[record.userId].pictureUrl) {
                pictureUrl = userMap[record.userId].pictureUrl;
            }
            // ถ้าไม่มีใน userMap ลองใช้ record.pictureUrl (ถ้ามี)
            else if (record.pictureUrl) {
                pictureUrl = record.pictureUrl;
            }
            
            // ✅ กำหนด returnStatus (ข้อมูลเก่าให้เป็น 'returned')
            let returnStatus = record.returnStatus;
            if (!returnStatus) {
                returnStatus = 'returned';
            }
            
            return {
                _id: record._id || record.id || String(Date.now()),
                name: record.name || record.originalName || record.displayName || 'ไม่ระบุชื่อ',
                phone: record.phone || '-',
                car: record.car || 'ไม่ระบุ',
                mileage: record.mileage || '0',
                reason: record.reason || '-',
                totalDistance: record.totalDistance || 0,
                totalTime: record.totalTime || 0,
                timestamp: record.timestamp || new Date().toISOString(),
                destinations: record.destinations || [],
                hasPhoto: record.hasPhoto || false,
                routeText: record.routeText || '',
                pictureUrl: pictureUrl || null,
                returnStatus: returnStatus,
                userId: record.userId || null,
                source: record.userId ? 'new_bin' : 'old_bin'
            };
        });

        // เรียงลำดับตาม timestamp (ล่าสุดขึ้นก่อน)
        formattedRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log(`✅ ส่งข้อมูล ${formattedRecords.length} รายการ (ใหม่ ${formattedRecords.filter(r => r.source === 'new_bin').length} รายการ)`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(formattedRecords)
        };

    } catch (error) {
        console.error('Error fetching records:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
        };
    }
};