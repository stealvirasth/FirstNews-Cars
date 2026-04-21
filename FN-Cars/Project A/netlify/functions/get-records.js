// netlify/functions/get-records.js
const JSONBIN_API = 'https://api.jsonbin.io/v3/b';
const OLD_BIN_ID = '69004526d0ea881f40c15ac0';
const NEW_BIN_ID = '69d38562aaba882197cbd71e';
const MASTER_KEY = '$2a$10$rrkK3fr7FCHp7uQlGy201uITw7TgSBKmb0xf0R2EeDod9V405xU6m';

// ✅ แมป userId -> pictureUrl
const userPictureMap = {
    'Ua9490a3b7343b375e3dfcb4c101c8a68': 'https://profile.line-scdn.net/0ht96up6gmKxYbDDTooX9VKGtcKHw4fXIEMWo3dixfISYhNGVBY2xmIi4OJiUjbjwSYmJsJShbJ3M5eh8DdBdlJldnfHtUUhcAdDgYMGtRAm1tUmoWZCEzFllEAntzeBs2azAzEnl5EXZ_PzUBSS4kNm0QPnNxPwgabVtHQB4-RZV0DlxDNmticCwNcCKn',
    'Uc8695dc6e2569a960fe8912809a2e2ff': 'https://profile.line-scdn.net/0h3LEGk3aRbGNoPn3BUZgSXRhubwlLTzVxQFF2V1htZgMACCpiQF0mUlluZgZXCCpiQQtzAA1rNFVKDmlzDydfYDN2WQ48UnNoTT1aDTpQe1AXDGo3RV51W19BTCYvaX5KJjpcYVpcdgEAbHhFMjggYzV1aD0tD0NyQ2kANW0MAuAHPBs2RVklBV8_N1fU',
    'U4efe94e959988456d563747564d3a435': 'https://profile.line-scdn.net/0hB7LxVvC1HRhhAQIIL_ljJhFRHnJCcEQKS2JXKgQISytbY18dRWdbe1RWQX1dMQoeTm5begQCESlDOT0PNDoZIygENkweVTImBhITDR8GBUlcdh4LSjIkAw1mPC0ObA9LCBcAf1J2OlZZcDMyLmEaIgF2OyEeQiQHI1ZxTmQzc5sOA2pNTGZUflYARizd',
    'U3e8201d1672346cac5fde4a9bc8d728c': 'https://profile.line-scdn.net/0h5ZokixBzanVCEnXBEkoUSzJCaR9hYzNnaiMiRiBFYER6ISorZychECdHZEUtK3klO3IsFH8bMEFgTFdcMXVBSyRSaxUUJUNCGBQ5RSFgbxp_IUlCFDFHVhRRNUccaUVqCQdBUTVLax83dkVLEgN6ahdMSTosRH19aEUGI0cgBPYtEB0gb3UjE3UTMUH-',
    'Udf775b0bdb11a86aa2d80bd223459a93': 'https://profile.line-scdn.net/0hP9Zc7pfGDxZ3Gh6yQ9JxaQdKDHxUa1YEXX9DcUoSUyJOLE0QCXoTeEcTVyQYekhEWn5EeUATWXN7CXhwaUzzInAqUidLLEhCWnlE8Q'
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    console.log('🔍 เริ่มต้นดึงข้อมูล...');
    
    // 1. ดึงข้อมูลจาก Bin เก่า
    let oldRecords = [];
    try {
      const oldResponse = await fetch(`${JSONBIN_API}/${OLD_BIN_ID}/latest`, {
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

    // 2. ดึงข้อมูลจาก Bin ใหม่
    let newRecords = [];
    try {
      const newResponse = await fetch(`${JSONBIN_API}/${NEW_BIN_ID}/latest`, {
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

    // 3. รวมข้อมูลทั้งหมด
    const allRecords = [...oldRecords, ...newRecords];

    // 4. แปลงข้อมูล พร้อมเพิ่ม pictureUrl และ returnStatus
    const formattedRecords = allRecords.map(record => {
        // หา pictureUrl จาก userId หรือชื่อ
        let pictureUrl = null;
        
        // 1. ถ้ามี userId ใน record และมีใน map
        if (record.userId && userPictureMap[record.userId]) {
            pictureUrl = userPictureMap[record.userId];
        }
        // 2. ถ้าไม่มี userId ลองจับคู่จากชื่อ
        else if (record.name) {
            if (record.name === 'พิมพ์มี่') pictureUrl = userPictureMap['Ua9490a3b7343b375e3dfcb4c101c8a68'];
            else if (record.name === 'ยอด' || record.name === 'ยอด G') pictureUrl = userPictureMap['Uc8695dc6e2569a960fe8912809a2e2ff'];
            else if (record.name === 'เหมียว') pictureUrl = userPictureMap['U4efe94e959988456d563747564d3a435'];
            else if (record.name === 'แน็ค') pictureUrl = userPictureMap['U3e8201d1672346cac5fde4a9bc8d728c'];
            else if (record.name === 'แต๊งค์' || record.name === 'แตงค์') pictureUrl = userPictureMap['Udf775b0bdb11a86aa2d80bd223459a93'];
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
            returnStatus: returnStatus
        };
    });

    // เรียงลำดับตาม timestamp (ล่าสุดขึ้นก่อน)
    formattedRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`✅ รวมทั้งหมด: ${formattedRecords.length} รายการ`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedRecords)
    };
  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
};