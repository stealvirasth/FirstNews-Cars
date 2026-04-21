// netlify/functions/save-record.js
const JSONBIN_API = 'https://api.jsonbin.io/v3/b';
const JSONBIN_ID = '69d38562aaba882197cbd71e';
const JSONBIN_KEY = '$2a$10$rrkK3fr7FCHp7uQlGy201uITw7TgSBKmb0xf0R2EeDod9V405xU6m';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);
    console.log('📥 Saving record:', data);

    // 1. ดึงข้อมูลเดิมจาก JSONBin
    let existingRecords = [];
    const getResponse = await fetch(`${JSONBIN_API}/${JSONBIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_KEY, 'X-Bin-Meta': 'false' }
    });
    
    if (getResponse.ok) {
      const binData = await getResponse.json();
      console.log('📦 Raw data from JSONBin:', JSON.stringify(binData).substring(0, 200));
      
      // 🔧 ปรับปรุง: รองรับหลายรูปแบบ
      if (binData.record && Array.isArray(binData.record.records)) {
        existingRecords = binData.record.records;
      } 
      else if (binData.record && Array.isArray(binData.record)) {
        existingRecords = binData.record;
      }
      else if (binData.records && Array.isArray(binData.records)) {
        existingRecords = binData.records;
      }
      else if (Array.isArray(binData)) {
        existingRecords = binData;
      }
      else if (binData.record && !Array.isArray(binData.record)) {
        existingRecords = [binData.record];
      }
      else {
        existingRecords = [];
      }
      
      console.log(`📦 พบข้อมูลเดิม ${existingRecords.length} รายการ`);
    } else {
      console.log('📦 ไม่มีข้อมูลเดิม สร้างใหม่');
    }

    // 2. สร้าง record ใหม่ (เพิ่ม id, timestamp และ returnStatus)
    const newRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      userId: data.userId || 'unknown',
      name: data.mappedName || data.name || data.displayName || 'ไม่ระบุชื่อ',
      phone: data.phone || '-',
      car: data.car || '-',
      mileage: data.mileage || '0',
      reason: data.reason || '',
      routeText: data.routeText || '',
      destinations: data.destinations || [],
      totalDistance: data.totalDistance || 0,
      totalTime: data.totalTime || 0,
      hasPhoto: data.hasPhoto || false,
      returnStatus: 'pending'  // ✅ เพิ่มฟิลด์สถานะ: pending = ยังไม่คืนรถ
    };

    // 3. เพิ่ม record ใหม่ต่อท้าย (ไม่ทับ)
    existingRecords.push(newRecord);
    console.log(`✅ รวมแล้ว ${existingRecords.length} รายการ (เพิ่มรายการใหม่)`);

    // 4. บันทึกกลับไป JSONBin (ต้องเป็น object ที่มี records)
    const saveData = { records: existingRecords };
    
    const putResponse = await fetch(`${JSONBIN_API}/${JSONBIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_KEY
      },
      body: JSON.stringify(saveData)
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error('❌ JSONBin save error:', errorText);
      throw new Error(`Save failed: ${putResponse.status}`);
    }

    console.log('✅ บันทึกสำเร็จ');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: newRecord.id, total: existingRecords.length })
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};