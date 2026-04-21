// netlify/functions/update-record.js
const JSONBIN_API = 'https://api.jsonbin.io/v3/b';
const JSONBIN_ID = '69d38562aaba882197cbd71e';
const MASTER_KEY = '$2a$10$rrkK3fr7FCHp7uQlGy201uITw7TgSBKmb0xf0R2EeDod9V405xU6m';

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
    const { records } = JSON.parse(event.body);
    
    console.log('📤 อัปเดต JSONBin ด้วย ID:', JSONBIN_ID);
    
    // ✅ ใช้ PUT เพื่ออัปเดตทั้ง bin
    const putResponse = await fetch(`${JSONBIN_API}/${JSONBIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY,
        'X-Bin-Meta': 'false'
      },
      body: JSON.stringify({ records: records })
    });

    console.log('📡 Response status:', putResponse.status);
    
    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error('❌ JSONBin error:', errorText);
      throw new Error(`Update failed: ${putResponse.status} - ${errorText}`);
    }

    const result = await putResponse.json();
    console.log('✅ อัปเดตสถานะคืนรถสำเร็จ:', result);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
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