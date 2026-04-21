// script.js (โปรเจกต์ A) - เพิ่มฟังก์ชันอัปเดตรูปโปรไฟล์
// ===== CONFIGURATION =====
const CONFIG = {
    liffId: "2007130450-YVNvyNbL",
    googleMapsKey: "AIzaSyAw5sDr5qXKIpun2dp4jpu8NerbXy6Hfew",
    autoDestination: {
        userId: 'Uc8695dc6e2569a960fe8912809a2e2ff', // ยอด
        startTime: { hour: 16, minute: 40 },
        endTime: { hour: 17, minute: 20 },
        location: { lat: 14.975057297021436, lng: 102.11365790021132 }
    }
};

// ===== JSONBIN.IO CONFIGURATION =====
const JSONBIN_CONFIG = {
    masterKey: '$2a$10$LNypgTkG2rULWdxsEP.RMuzVeymSD4m6P6Fq74uvZADguTLizt/0i',
    configBinId: '',
    userBinId: '699fc030d0ea881f40da5eef',
    requestBinId: '699fc886d0ea881f40da6d4a',
    accessKey: '$2a$10$oa3OraBEHwOwQxRCpL66qOfvyF8BEx3HWbPhtp2AX.mZWf7gY2svO'
};

// ===== GLOBAL VARIABLES =====
let markers = [];
let directionsRenderer;
let directionsService;
let map;
let autocomplete;
let currentUser = null;
let mapInitialized = false;

const originLatLng = { lat: 14.975719186601136, lng: 102.1254756236624 };

// ========== ระบบการใช้รถ (เพิ่มใหม่) ==========

// 🚗 คีย์สำหรับเก็บสถานะการใช้รถใน localStorage
const CAR_USAGE_KEY = 'current_car_usage';

// 📦 โครงสร้างสถานะการใช้รถ
let currentCarUsage = {
    isUsing: false,
    carPlate: null,
    startedAt: null,
    userName: null,
    userId: null,
    carModel: null,
    mileage: null
};

// 📍 ตัวแปรสำหรับเก็บตำแหน่งคืนรถ
let returnLocation = null;

// ✅ โหลดสถานะจาก localStorage เมื่อเริ่มต้น
function loadCarUsageState() {
    const saved = localStorage.getItem(CAR_USAGE_KEY);
    if (saved) {
        try {
            currentCarUsage = JSON.parse(saved);
            console.log('🚗 โหลดสถานะการใช้รถ:', currentCarUsage);
        } catch(e) {
            console.error('โหลดสถานะล้มเหลว:', e);
        }
    }
}

// 💾 บันทึกสถานะการใช้รถ
function saveCarUsageState() {
    localStorage.setItem(CAR_USAGE_KEY, JSON.stringify(currentCarUsage));
}

// 📍 ดึงตำแหน่ง GPS ปัจจุบัน
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('เบราว์เซอร์นี้ไม่รองรับการดึงตำแหน่ง'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                console.log('📍 ได้ตำแหน่งปัจจุบัน:', location);
                resolve(location);
            },
            (error) => {
                let errorMessage = 'ไม่สามารถดึงตำแหน่งได้';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'กรุณาอนุญาตให้เข้าถึงตำแหน่งที่ตั้ง';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'ไม่สามารถระบุตำแหน่งได้';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'การดึงตำแหน่งหมดเวลา';
                        break;
                }
                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// 🟢 เริ่มใช้รถ (เรียกหลังจากสแกนสำเร็จ)
function startUsingCar(carPlate, carModel, userName, userId, mileage) {
    // ✅ เก็บ carPlate แบบเต็ม (รวมรุ่นรถด้วย)
    const fullCarPlate = carPlate;
    
    currentCarUsage = {
        isUsing: true,
        carPlate: fullCarPlate,
        carModel: carModel,
        startedAt: new Date().toISOString(),
        userName: userName,
        userId: userId,
        mileage: mileage
    };
    saveCarUsageState();
    showCarInUseScreen();
}

// 🔴 คืนรถ (พร้อมตำแหน่ง)
async function returnCarWithLocation(location) {
    if (!currentCarUsage.isUsing) {
        showNotification('⚠️ ไม่ได้กำลังใช้รถคันใด', 'warning');
        return false;
    }
    
    if (!location) {
        showNotification('⚠️ กรุณาดึงตำแหน่งก่อนคืนรถ', 'warning');
        return false;
    }

    const returnTime = new Date();
    const startTime = new Date(currentCarUsage.startedAt);
    const durationMs = returnTime - startTime;
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationHours = Math.floor(durationMinutes / 60);
    const durationText = durationHours > 0 
        ? `${durationHours} ชั่วโมง ${durationMinutes % 60} นาที`
        : `${durationMinutes} นาที`;

    const googleMapsLink = `https://www.google.com/maps?q=${location.lat},${location.lng}`;

    // 📝 ข้อความที่จะแชร์ (เพิ่มปุ่มดูตำแหน่ง)
    const shareMessage = {
        type: "flex",
        altText: `🔑 คืนรถแล้ว: ${currentCarUsage.carPlate}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{
                    type: "text",
                    text: "🔑 แจ้งคืนรถ",
                    weight: "bold",
                    size: "xl",
                    color: "#FFFFFF",
                    align: "center"
                }],
                backgroundColor: "#E74C3C",
                paddingAll: "15px"
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    { type: "text", text: `🚗 ทะเบียนรถ: ${currentCarUsage.carPlate}`, size: "md", wrap: true },
                    { type: "text", text: `👤 ผู้ใช้: ${currentCarUsage.userName}`, size: "md", wrap: true },
                    { type: "text", text: `📅 วันที่: ${returnTime.toLocaleDateString('th-TH')}`, size: "md", wrap: true },
                    { type: "text", text: `⏰ เวลาที่คืน: ${returnTime.toLocaleTimeString('th-TH')}`, size: "md", wrap: true },
                    { type: "text", text: `⏱ ระยะเวลาที่ใช้: ${durationText}`, size: "md", wrap: true, color: "#E74C3C", weight: "bold" },
                    { type: "separator", margin: "md" },
                    { type: "text", text: "📍 ตำแหน่งที่คืนรถ:", size: "sm", weight: "bold", margin: "md" },
                    { type: "text", text: `ละติจูด: ${location.lat.toFixed(6)}`, size: "sm", wrap: true },
                    { type: "text", text: `ลองจิจูด: ${location.lng.toFixed(6)}`, size: "sm", wrap: true, margin: "xs" }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        action: {
                            type: "uri",
                            label: "🗺️ ดูตำแหน่งคืนรถ",
                            uri: googleMapsLink
                        },
                        style: "link",
                        color: "#3498db"
                    },
                    {
                        type: "button",
                        action: {
                            type: "uri",
                            label: "📊 ดูประวัติการใช้รถ",
                            uri: "https://car-log-history.netlify.app/"
                        },
                        style: "primary",
                        color: "#2ECC71"
                    }
                ]
            }
        }
    };

    // 📤 แชร์ผ่าน Share Target Picker
    if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
        try {
            await liff.shareTargetPicker([shareMessage]);
            console.log('✅ แชร์คืนรถสำเร็จ');
        } catch (shareError) {
            console.log('❌ แชร์ล้มเหลว:', shareError);
        }
    } else {
        console.log('Preview mode:', shareMessage);
        showNotification('📤 Preview: คืนรถ', 'info');
    }

    // ✅ อัปเดตสถานะการคืนรถใน JSONBin (พร้อมบันทึกตำแหน่ง)
    console.log('🔍 เริ่มอัปเดตสถานะ...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        const getUrl = 'https://api.jsonbin.io/v3/b/69d38562aaba882197cbd71e/latest';
        const getResponse = await fetch(getUrl, {
            headers: { 
                'X-Master-Key': '$2a$10$rrkK3fr7FCHp7uQlGy201uITw7TgSBKmb0xf0R2EeDod9V405xU6m', 
                'X-Bin-Meta': 'false' 
            }
        });
        
        if (!getResponse.ok) {
            throw new Error(`ดึงข้อมูลไม่ได้: ${getResponse.status}`);
        }
        
        const binData = await getResponse.json();
        let newBinRecords = [];
        
        if (binData.record && Array.isArray(binData.record.records)) {
            newBinRecords = binData.record.records;
        } else if (binData.records && Array.isArray(binData.records)) {
            newBinRecords = binData.records;
        } else if (Array.isArray(binData)) {
            newBinRecords = binData;
        } else {
            newBinRecords = [];
        }
        
        let targetIndex = -1;
        for (let i = newBinRecords.length - 1; i >= 0; i--) {
            const record = newBinRecords[i];
            if (record.car === currentCarUsage.carPlate) {
                targetIndex = i;
                break;
            }
        }
        
        if (targetIndex !== -1) {
            newBinRecords[targetIndex].returnStatus = 'returned';
            newBinRecords[targetIndex].returnedAt = returnTime.toISOString();
            newBinRecords[targetIndex].durationText = durationText;
            newBinRecords[targetIndex].returnLocation = location;
            
            const putUrl = 'https://api.jsonbin.io/v3/b/69d38562aaba882197cbd71e';
            const putResponse = await fetch(putUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': '$2a$10$rrkK3fr7FCHp7uQlGy201uITw7TgSBKmb0xf0R2EeDod9V405xU6m'
                },
                body: JSON.stringify({ records: newBinRecords })
            });
            
            if (putResponse.ok) {
                console.log('✅ อัปเดตสถานะคืนรถสำเร็จ');
            }
        }
    } catch (error) {
        console.error('❌ อัปเดตสถานะล้มเหลว:', error);
    }

    const carPlateSaved = currentCarUsage.carPlate;
    
    currentCarUsage = {
        isUsing: false,
        carPlate: null,
        startedAt: null,
        userName: null,
        userId: null,
        carModel: null,
        mileage: null
    };
    saveCarUsageState();

    showNotification(`✅ คืนรถ ${carPlateSaved} สำเร็จ`, 'success');
    
    const carInUseScreen = document.getElementById('carInUseScreen');
    if (carInUseScreen) carInUseScreen.style.display = 'none';
    
    if (currentUser) {
        showNormalUI(currentUser);
    } else {
        location.reload();
    }
    
    return true;
}

// 📱 แสดงหน้าจอ "กำลังใช้รถ" (พร้อมระบบดึงตำแหน่ง)
function showCarInUseScreen() {
    // ซ่อน UI ปกติทั้งหมด
    const headerCard = document.querySelector('.header-card');
    const userBadge = document.getElementById('userBadge');
    const formCard = document.querySelector('.form-card');
    const mapCard = document.querySelector('.map-card');
    const fabContainer = document.querySelector('.fab-container');
    const pendingMessage = document.getElementById('pendingMessage');
    const registrationForm = document.getElementById('registrationForm');
    
    if (headerCard) headerCard.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';
    if (formCard) formCard.style.display = 'none';
    if (mapCard) mapCard.style.display = 'none';
    if (fabContainer) fabContainer.style.display = 'none';
    if (pendingMessage) pendingMessage.style.display = 'none';
    if (registrationForm) registrationForm.style.display = 'none';

    // สร้างหน้าจอ "กำลังใช้รถ" ถ้ายังไม่มี
    let carInUseScreen = document.getElementById('carInUseScreen');
    if (!carInUseScreen) {
        carInUseScreen = document.createElement('div');
        carInUseScreen.id = 'carInUseScreen';
        carInUseScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #2c3e50, #1a1a2e);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
            overflow-y: auto;
        `;
        document.body.appendChild(carInUseScreen);
    }

    const startDate = new Date(currentCarUsage.startedAt);
    
    carInUseScreen.innerHTML = `
        <div style="
            background: white;
            border-radius: 30px;
            padding: 30px 25px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.5s ease;
        ">
            <div style="font-size: 70px; margin-bottom: 15px;">
                🚗🔑
            </div>
            <h2 style="color: #2c3e50; font-size: 28px; margin-bottom: 10px;">
                กำลังใช้รถ
            </h2>
            <div style="
                background: #f8f9fa;
                border-radius: 20px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
            ">
                <p style="margin: 8px 0;"><strong>🚘 ทะเบียนรถ:</strong> ${currentCarUsage.carPlate}</p>
                <p style="margin: 8px 0;"><strong>👤 ผู้ใช้:</strong> ${currentCarUsage.userName}</p>
                <p style="margin: 8px 0;"><strong>📅 เริ่มใช้:</strong> ${startDate.toLocaleString('th-TH')}</p>
                <p style="margin: 8px 0;"><strong>📍 ไมล์เริ่มต้น:</strong> ${currentCarUsage.mileage}</p>
            </div>
            
            <!-- 📍 ส่วนแสดงตำแหน่งคืนรถ -->
            <div style="
                background: #e8f5e9;
                border-radius: 16px;
                padding: 16px;
                margin: 16px 0;
                text-align: left;
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <i class="fas fa-map-marker-alt" style="color: #2ecc71;"></i>
                    <strong style="color: #2c3e50;">ตำแหน่งคืนรถ</strong>
                </div>
                <div id="locationStatus" style="font-size: 13px; color: #7f8c8d; margin-bottom: 12px;">
                    ⏳ ยังไม่ได้ระบุตำแหน่ง
                </div>
                <div id="locationDisplay" style="font-size: 12px; color: #2c3e50; word-break: break-all; display: none;">
                </div>
                <button id="getLocationBtn" style="
                    background: #3498db;
                    color: white;
                    border: none;
                    padding: 10px 16px;
                    border-radius: 30px;
                    font-size: 14px;
                    font-weight: 500;
                    width: 100%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 8px;
                ">
                    <i class="fas fa-location-dot"></i>
                    ดึงตำแหน่งปัจจุบัน
                </button>
            </div>
            
            <button id="returnCarBtn" style="
                background: linear-gradient(135deg, #e74c3c, #c0392b);
                color: white;
                border: none;
                padding: 16px 32px;
                border-radius: 50px;
                font-size: 18px;
                font-weight: 600;
                width: 100%;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: 'Kanit', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                opacity: 0.5;
                pointer-events: none;
            ">
                <i class="fas fa-undo-alt"></i>
                คืนรถ (ต้องดึงตำแหน่งก่อน)
            </button>
            <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
                ⚠️ กรุณากด "ดึงตำแหน่งปัจจุบัน" ก่อนคืนรถ
            </p>
        </div>
    `;

    carInUseScreen.style.display = 'flex';

    // เพิ่ม event ให้ปุ่มดึงตำแหน่ง (ใช้ returnLocation ตัวแปร global)
    const getLocationBtn = document.getElementById('getLocationBtn');
    const returnBtn = document.getElementById('returnCarBtn');
    const locationStatus = document.getElementById('locationStatus');
    const locationDisplay = document.getElementById('locationDisplay');
    
    if (getLocationBtn) {
        // ลบ disabled attribute ออกจาก HTML
        getLocationBtn.removeAttribute('disabled');
        
        getLocationBtn.onclick = async () => {
            getLocationBtn.disabled = true;
            getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังดึงตำแหน่ง...';
            locationStatus.innerHTML = '📍 กำลังดึงตำแหน่ง...';
            locationStatus.style.color = '#f39c12';
            
            try {
                const location = await getCurrentLocation();
                returnLocation = location;
                
                const googleMapsLink = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
                locationStatus.innerHTML = '✅ ดึงตำแหน่งสำเร็จ!';
                locationStatus.style.color = '#27ae60';
                locationDisplay.style.display = 'block';
                locationDisplay.innerHTML = `
                    <i class="fas fa-map-pin"></i> ละติจูด: ${location.lat.toFixed(6)}<br>
                    <i class="fas fa-map-pin"></i> ลองจิจูด: ${location.lng.toFixed(6)}<br>
                    <a href="${googleMapsLink}" target="_blank" style="color: #3498db; text-decoration: none;">
                        <i class="fas fa-external-link-alt"></i> เปิดใน Google Maps
                    </a>
                `;
                
                // เปิดใช้งานปุ่มคืนรถ
                returnBtn.style.opacity = '1';
                returnBtn.style.pointerEvents = 'auto';
                returnBtn.innerHTML = '<i class="fas fa-undo-alt"></i> คืนรถ';
                
                getLocationBtn.innerHTML = '<i class="fas fa-check-circle"></i> ดึงตำแหน่งสำเร็จ';
                getLocationBtn.style.background = '#27ae60';
                getLocationBtn.disabled = false;
                
            } catch (error) {
                console.error('ดึงตำแหน่งล้มเหลว:', error);
                locationStatus.innerHTML = `❌ ${error.message}`;
                locationStatus.style.color = '#e74c3c';
                getLocationBtn.innerHTML = '<i class="fas fa-redo-alt"></i> ลองอีกครั้ง';
                getLocationBtn.disabled = false;
                returnLocation = null;
            }
        };
    }
    
    if (returnBtn) {
        returnBtn.onclick = async () => {
            if (!returnLocation) {
                showNotification('⚠️ กรุณาดึงตำแหน่งก่อนคืนรถ', 'warning');
                return;
            }
            returnBtn.disabled = true;
            returnBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังคืนรถ...';
            await returnCarWithLocation(returnLocation);
            returnBtn.disabled = false;
        };
    }
}

// ✅ ตรวจสอบก่อนสแกนว่ารถกำลังถูกใช้อยู่หรือไม่
function canScanCar() {
    if (currentCarUsage.isUsing) {
        showNotification(`⚠️ รถ ${currentCarUsage.carPlate} กำลังถูกใช้อยู่ กรุณาคืนรถก่อน`, 'warning');
        showCarInUseScreen();
        return false;
    }
    return true;
}

// ✅ ฟังก์ชันอัปเดตรูปโปรไฟล์ใน JSONBin
async function updateUserProfilePicture() {
    if (!currentUser || !currentUser.userId) return;
    
    try {
        // ดึงรูปปัจจุบันจาก LINE
        const profile = await liff.getProfile();
        const currentPictureUrl = profile.pictureUrl;
        
        // ดึงข้อมูลผู้ใช้จาก JSONBin
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_CONFIG.userBinId}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_CONFIG.masterKey, 'X-Bin-Meta': 'false' }
        });
        const data = await response.json();
        const userMap = data.record || data;
        
        // ถ้ารูปเปลี่ยน ให้อัปเดต
        if (userMap[currentUser.userId] && userMap[currentUser.userId].pictureUrl !== currentPictureUrl) {
            userMap[currentUser.userId].pictureUrl = currentPictureUrl;
            userMap[currentUser.userId].updatedAt = new Date().toISOString();
            
            // บันทึกกลับ
            await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_CONFIG.userBinId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_CONFIG.masterKey
                },
                body: JSON.stringify(userMap)
            });
            console.log('✅ อัปเดตรูปโปรไฟล์สำเร็จ');
        }
    } catch (error) {
        console.warn('⚠️ อัปเดตรูปโปรไฟล์ไม่สำเร็จ:', error);
    }
}

// ===== ฟังก์ชันโหลดจาก JSONBin =====
async function loadJSONBin(binId, useMasterKey = false) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'X-Bin-Meta': 'false'
        };
        
        if (useMasterKey) {
            headers['X-Master-Key'] = JSONBIN_CONFIG.masterKey;
        } else {
            headers['X-Access-Key'] = JSONBIN_CONFIG.accessKey;
        }
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error(`JSONBin error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.record || data;
        
    } catch (error) {
        console.error('Failed to load from JSONBin:', error);
        return null;
    }
}

// ===== ฟังก์ชันขออนุมัติผู้ใช้ใหม่ =====
async function requestNewUserApproval(userData) {
    try {
        const requestBinId = JSONBIN_CONFIG.requestBinId;
        
        if (!requestBinId) {
            console.log('⚠️ ไม่มี requestBinId');
            return false;
        }
        
        const getResponse = await fetch(`https://api.jsonbin.io/v3/b/${requestBinId}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIG.masterKey,
                'X-Bin-Meta': 'false'
            }
        });
        
        let existingRequests = [];
        if (getResponse.ok) {
            const responseData = await getResponse.json();
            if (Array.isArray(responseData)) {
                existingRequests = responseData;
            } else if (responseData && typeof responseData === 'object') {
                existingRequests = Object.values(responseData);
            }
        }
        
        const existingUserRequest = existingRequests.find(req => 
            req && req.userData && req.userData.userId === userData.userId
        );
        
        if (existingUserRequest) {
            console.log('⏭️ มีคำขออนุมัติอยู่แล้ว');
            return true;
        }
        
        const newRequest = {
            id: Date.now().toString(),
            type: 'ผู้สมัครใช้งานใหม่',
            userData: {
                userId: userData.userId,
                displayName: userData.displayName,
                pictureUrl: userData.pictureUrl || null
            },
            requestedAt: new Date().toISOString(),
            status: 'pending'
        };
        
        existingRequests.push(newRequest);
        
        const putResponse = await fetch(`https://api.jsonbin.io/v3/b/${requestBinId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_CONFIG.masterKey
            },
            body: JSON.stringify(existingRequests)
        });
        
        if (putResponse.ok) {
            console.log('✅ ส่งคำขออนุมัติสำเร็จ:', userData.displayName);
            return true;
        } else {
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error in requestNewUserApproval:', error);
        return false;
    }
}

// ===== ฟังก์ชันแสดงฟอร์มสมัครสมาชิก =====
function showRegistrationForm() {
    const headerCard = document.querySelector('.header-card');
    const userBadge = document.getElementById('userBadge');
    const formCard = document.querySelector('.form-card');
    const mapCard = document.querySelector('.map-card');
    const fabContainer = document.querySelector('.fab-container');
    const pendingMessage = document.getElementById('pendingMessage');
    const registrationForm = document.getElementById('registrationForm');
    
    if (headerCard) headerCard.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';
    if (formCard) formCard.style.display = 'none';
    if (mapCard) mapCard.style.display = 'none';
    if (fabContainer) fabContainer.style.display = 'none';
    if (pendingMessage) pendingMessage.style.display = 'none';
    
    if (registrationForm) {
        registrationForm.style.display = 'block';
        
        if (currentUser && currentUser.pictureUrl) {
            const headerIcon = registrationForm.querySelector('.registration-header i');
            if (headerIcon) {
                headerIcon.style.display = 'none';
                
                let profileImg = registrationForm.querySelector('.profile-img');
                if (!profileImg) {
                    profileImg = document.createElement('img');
                    profileImg.className = 'profile-img';
                    profileImg.style.cssText = `
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        object-fit: cover;
                        border: 3px solid #2ecc71;
                    `;
                    registrationForm.querySelector('.registration-header').insertBefore(profileImg, headerIcon.nextSibling);
                }
                profileImg.src = currentUser.pictureUrl;
                profileImg.alt = currentUser.displayName;
            }
        }
    }
}

function cancelRegistration() {
    const registrationForm = document.getElementById('registrationForm');
    const pendingMessage = document.getElementById('pendingMessage');
    
    if (registrationForm) registrationForm.style.display = 'none';
    if (pendingMessage) pendingMessage.style.display = 'flex';
}

// ===== ฟังก์ชันตรวจสอบคำขอที่มีอยู่ =====
async function checkExistingRequest(userId) {
    try {
        const requestBinId = JSONBIN_CONFIG.requestBinId;
        if (!requestBinId) return false;
        
        const response = await fetch(`https://api.jsonbin.io/v3/b/${requestBinId}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIG.masterKey,
                'X-Bin-Meta': 'false'
            }
        });
        
        if (!response.ok) return false;
        
        const data = await response.json();
        let requests = [];
        
        if (data.record && Array.isArray(data.record)) {
            requests = data.record;
        } else if (Array.isArray(data)) {
            requests = data;
        } else if (data && typeof data === 'object') {
            requests = Object.values(data);
        }
        
        return requests.some(req => 
            req && req.userData && req.userData.userId === userId && req.status === 'pending'
        );
        
    } catch (error) {
        console.error('Error checking existing request:', error);
        return false;
    }
}

// ===== ฟังก์ชันส่งคำขออนุมัติพร้อมข้อมูลเพิ่มเติม =====
async function submitRegistration(userId, displayName, pictureUrl, formData) {
    try {
        const requestBinId = JSONBIN_CONFIG.requestBinId;
        
        if (!requestBinId) {
            throw new Error('ไม่พบ Request Bin ID');
        }
        
        const getResponse = await fetch(`https://api.jsonbin.io/v3/b/${requestBinId}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_CONFIG.masterKey,
                'X-Bin-Meta': 'false'
            }
        });
        
        let existingRequests = [];
        if (getResponse.ok) {
            const responseData = await getResponse.json();
            existingRequests = Array.isArray(responseData) ? responseData : 
                              (responseData.record ? responseData.record : []);
        }
        
        const existingRequest = existingRequests.find(req => 
            req && req.userData && req.userData.userId === userId
        );
        
        if (existingRequest) {
            showNotification('คุณได้ส่งคำขออนุมัติไปแล้ว กรุณารอการตอบกลับ', 'warning');
            return false;
        }
        
        const newRequest = {
            id: Date.now().toString(),
            type: 'ผู้สมัครใช้งานใหม่',
            userData: {
                userId: userId,
                displayName: displayName,
                pictureUrl: pictureUrl || null,
                fullName: formData.fullName,
                phone: formData.phone,
                department: formData.department,
                otherDepartment: formData.otherDepartment || null
            },
            requestedAt: new Date().toISOString(),
            status: 'pending'
        };
        
        existingRequests.push(newRequest);
        
        const putResponse = await fetch(`https://api.jsonbin.io/v3/b/${requestBinId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_CONFIG.masterKey
            },
            body: JSON.stringify(existingRequests)
        });
        
        if (putResponse.ok) {
            console.log('✅ ส่งคำขออนุมัติสำเร็จ:', displayName);
            showSuccessPopup();
            
            setTimeout(() => {
                const registrationForm = document.getElementById('registrationForm');
                const pendingMessage = document.getElementById('pendingMessage');
                
                if (registrationForm) registrationForm.style.display = 'none';
                if (pendingMessage) {
                    const messageEl = pendingMessage.querySelector('p');
                    const titleEl = pendingMessage.querySelector('h2');
                    
                    if (titleEl) titleEl.textContent = '⏳ ส่งคำขอเรียบร้อย';
                    if (messageEl) {
                        messageEl.innerHTML = `ขอบคุณคุณ ${displayName}<br>คำขอของคุณถูกส่งถึง Admin แล้ว<br>กรุณารอการอนุมัติ (ภายใน 24 ชั่วโมง)`;
                    }
                    pendingMessage.style.display = 'flex';
                }
            }, 3000);
            
            return true;
        } else {
            throw new Error('ไม่สามารถบันทึกข้อมูลได้');
        }
        
    } catch (error) {
        console.error('❌ Error in submitRegistration:', error);
        showNotification('เกิดข้อผิดพลาด: ' + error.message, 'error');
        return false;
    }
}

// ===== ฟังก์ชันแสดง popup สำเร็จ =====
function showSuccessPopup() {
    const popup = document.getElementById("popupModal");
    if (!popup) return;
    
    const title = popup.querySelector('.modal-title');
    const message = popup.querySelector('.modal-message');
    const icon = popup.querySelector('.modal-icon i');
    const autoClose = popup.querySelector('.modal-auto-close');
    
    if (title) title.textContent = 'ส่งคำขอสำเร็จ!';
    if (message) message.innerHTML = 'คำขอของคุณถูกส่งถึง Admin แล้ว<br>กรุณารอการอนุมัติ';
    if (icon) {
        icon.className = 'fas fa-paper-plane';
        icon.style.color = '#2ecc71';
    }
    
    if (autoClose) {
        autoClose.innerHTML = `
            <i class="fas fa-leaf"></i>
            <span>⏳ กำลังปิดอัตโนมัติใน <span id="countdown-number">3</span> วินาที...</span>
        `;
        autoClose.style.animation = 'none';
    }
    
    popup.classList.add("show");
    
    let countdown = 3;
    const countdownElement = document.getElementById('countdown-number');
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownElement) {
            countdownElement.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            popup.classList.remove("show");
            
            if (typeof liff !== 'undefined' && liff.isInClient()) {
                liff.closeWindow();
            }
        }
    }, 1000);
    
    setTimeout(() => {
        clearInterval(countdownInterval);
        if (popup.classList.contains('show')) {
            popup.classList.remove("show");
            if (typeof liff !== 'undefined' && liff.isInClient()) {
                liff.closeWindow();
            }
        }
    }, 3500);
}

// ===== ฟังก์ชันเรียก Netlify Functions =====
async function callNetlifyFunction(functionName, data) {
    try {
        const response = await fetch(`/.netlify/functions/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.error(`Error calling ${functionName}:`, error);
        return { success: false, error: error.message };
    }
}

// ===== ฟังก์ชันจัดการ Loading =====
function showLoading(show = true) {
    const loading = document.getElementById("loading");
    if (loading) {
        if (show) {
            loading.classList.add("show");
        } else {
            loading.classList.remove("show");
        }
    }
}

// ===== ฟังก์ชันแสดงหน้าแจ้งเตือน =====
function showSuspendedMessage(userName) {
    const headerCard = document.querySelector('.header-card');
    const userBadge = document.getElementById('userBadge');
    const formCard = document.querySelector('.form-card');
    const mapCard = document.querySelector('.map-card');
    const fabContainer = document.querySelector('.fab-container');
    const registrationForm = document.getElementById('registrationForm');
    const pendingMessage = document.getElementById('pendingMessage');
    
    if (headerCard) headerCard.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';
    if (formCard) formCard.style.display = 'none';
    if (mapCard) mapCard.style.display = 'none';
    if (fabContainer) fabContainer.style.display = 'none';
    if (registrationForm) registrationForm.style.display = 'none';
    
    if (!pendingMessage) return;
    
    const icon = pendingMessage.querySelector('.message-icon i');
    const title = pendingMessage.querySelector('h2');
    const message = pendingMessage.querySelector('p');
    const contactButton = pendingMessage.querySelector('.contact-button');
    
    if (icon) {
        icon.className = 'fas fa-ban';
        icon.style.color = '#e74c3c';
    }
    if (title) title.textContent = '⛔ ถูกระงับการใช้งาน';
    if (message) {
        message.innerHTML = `คุณ ${userName}<br>บัญชีของคุณถูกระงับการใช้งาน<br>กรุณาติดต่อผู้ดูแลระบบ`;
    }
    if (contactButton) {
        contactButton.style.display = 'inline-flex';
    }
    
    pendingMessage.style.display = 'flex';
}

// ===== ฟังก์ชันแสดง notification =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#2ecc71' : '#3498db'};
        color: white;
        padding: 15px 25px;
        border-radius: 50px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 15px;
        animation: slideDown 0.3s ease;
        max-width: 90%;
        white-space: pre-line;
        text-align: center;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ===== ฟังก์ชันจัดการ Error =====
function showError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}-error`);
    if (errorElement) {
        errorElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorElement.classList.add('show');
        
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '#E74C3C';
            setTimeout(() => {
                field.style.borderColor = '';
            }, 3000);
        }
        
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function clearError(fieldId) {
    const errorElement = document.getElementById(`${fieldId}-error`);
    if (errorElement) {
        errorElement.classList.remove('show');
        errorElement.innerHTML = '';
    }
}

// ===== ฟังก์ชันจัดการ Map Status =====
function updateMapStatus(message, isError = false) {
    const statusElement = document.getElementById('map-status');
    if (statusElement) {
        const icon = statusElement.querySelector('i');
        const span = statusElement.querySelector('span');
        
        if (icon && span) {
            icon.className = isError ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
            span.textContent = message;
            
            if (isError) {
                statusElement.classList.add('error');
            } else {
                statusElement.classList.remove('error');
            }
            
            statusElement.classList.add('show');
            
            setTimeout(() => {
                statusElement.classList.remove('show');
            }, 3000);
        }
    }
}

// ===== ฟังก์ชันจัดการ User =====
function logout() {
    if (typeof liff !== 'undefined') {
        if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
            if (liff.isLoggedIn()) {
                liff.logout();
            }
            window.location.reload();
        }
    }
}

function checkEnvironment() {
    const isInLineClient = typeof liff !== 'undefined' && liff.isInClient?.();
    const isInBrowser = !isInLineClient;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    console.log('📱 Environment:', {
        isInLineClient,
        isInBrowser,
        isIOS,
        isAndroid,
        userAgent: navigator.userAgent
    });
    
    return { isInLineClient, isInBrowser, isIOS, isAndroid };
}

function showManualLoginForm() {
    const userBadge = document.getElementById('userBadge');
    if (userBadge) {
        userBadge.style.display = 'none';
    }
    
    updateMapStatus('⚠️ กำลังทำงานนอก LINE App', true);
}

function showUserBadge(name, pictureUrl, department = 'Green Member') {
    console.log('🔍 กำลังแสดง User Badge สำหรับ:', name);
    
    if (!document.getElementById('userBadge')) {
        setTimeout(() => showUserBadge(name, pictureUrl, department), 100);
        return;
    }
    
    const userBadge = document.getElementById('userBadge');
    const displayName = document.getElementById('displayName');
    const userAvatar = userBadge?.querySelector('.user-avatar');
    const greetingEl = userBadge?.querySelector('.user-greeting');
    const badgeIcon = userBadge?.querySelector('.user-badge-icon');
    
    if (userBadge && displayName && userAvatar) {
        displayName.textContent = name;
        
        if (badgeIcon) {
            badgeIcon.textContent = department;
        }
        
        if (pictureUrl) {
            userAvatar.innerHTML = '<div class="avatar-loading"></div>';
            
            const img = new Image();
            img.src = pictureUrl;
            img.alt = name;
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                userAvatar.innerHTML = '';
                userAvatar.appendChild(img);
            };
            img.onerror = () => {
                const initial = name.charAt(0).toUpperCase();
                userAvatar.innerHTML = `<div class="avatar-fallback">${initial}</div>`;
            };
        } else {
            const initial = name.charAt(0).toUpperCase();
            userAvatar.innerHTML = `<div class="avatar-fallback">${initial}</div>`;
        }
        
        const hour = new Date().getHours();
        let greeting = 'สวัสดี';
        if (hour < 12) greeting = 'อรุณสวัสดิ์';
        else if (hour < 18) greeting = 'สวัสดีตอนบ่าย';
        else greeting = 'สวัสดีตอนเย็น';
        
        if (greetingEl) {
            greetingEl.textContent = `${greeting} คุณ`;
        }
        
        userBadge.style.display = 'flex';
        userBadge.style.animation = 'none';
        userBadge.offsetHeight;
        userBadge.style.animation = 'slideRight 0.5s ease';
        
        console.log('✅ แสดง User Badge สำเร็จ');
    }
}

// ===== ฟังก์ชันแสดง UI ปกติ (สำหรับผู้ใช้อนุมัติแล้ว) =====
function showNormalUI(userData) {
    const headerCard = document.querySelector('.header-card');
    const userBadge = document.getElementById('userBadge');
    const formCard = document.querySelector('.form-card');
    const mapCard = document.querySelector('.map-card');
    const fabContainer = document.querySelector('.fab-container');
    const pendingMessage = document.getElementById('pendingMessage');
    const registrationForm = document.getElementById('registrationForm');
    const submitBtn = document.getElementById('submit-btn');
    
    if (headerCard) headerCard.style.display = 'block';
    if (userBadge) {
        userBadge.style.display = 'flex';
        showUserBadge(userData.displayName, userData.pictureUrl, userData.department);
    }
    if (formCard) formCard.style.display = 'block';
    if (mapCard) mapCard.style.display = 'block';
    if (fabContainer) fabContainer.style.display = 'block';
    if (submitBtn) submitBtn.style.display = 'flex';
    if (pendingMessage) pendingMessage.style.display = 'none';
    if (registrationForm) registrationForm.style.display = 'none';
}

// ===== ฟังก์ชันแสดง Pending Message =====
function showPendingMessage(userData, hasExistingRequest = false) {
    const headerCard = document.querySelector('.header-card');
    const userBadge = document.getElementById('userBadge');
    const formCard = document.querySelector('.form-card');
    const mapCard = document.querySelector('.map-card');
    const fabContainer = document.querySelector('.fab-container');
    const registrationForm = document.getElementById('registrationForm');
    const pendingMessage = document.getElementById('pendingMessage');
    
    if (headerCard) headerCard.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';
    if (formCard) formCard.style.display = 'none';
    if (mapCard) mapCard.style.display = 'none';
    if (fabContainer) fabContainer.style.display = 'none';
    if (registrationForm) registrationForm.style.display = 'none';
    
    if (!pendingMessage) return;
    
    const icon = pendingMessage.querySelector('.message-icon i');
    const title = pendingMessage.querySelector('h2');
    const message = pendingMessage.querySelector('p');
    const contactButton = pendingMessage.querySelector('.contact-button');
    
    if (icon) {
        icon.className = 'fas fa-clock';
        icon.style.color = '';
    }
    if (title) title.textContent = hasExistingRequest ? '⏳ กำลังรอการอนุมัติ' : '⏳ ส่งคำขอเรียบร้อย';
    if (message) {
        if (hasExistingRequest) {
            message.innerHTML = `สวัสดีคุณ ${userData.displayName}<br>คำขอของคุณกำลังรอการอนุมัติจาก Admin<br>กรุณาตรวจสอบอีกครั้งในภายหลัง`;
        } else {
            message.innerHTML = `ขอบคุณคุณ ${userData.displayName}<br>คำขอของคุณถูกส่งถึง Admin แล้ว<br>กรุณารอการอนุมัติ (ภายใน 24 ชั่วโมง)`;
        }
    }
    if (contactButton) {
        contactButton.style.display = 'inline-flex';
    }
    
    pendingMessage.style.display = 'flex';
}

// ✅ ฟังก์ชันอัปเดต UI ตามผู้ใช้
function updateUIForUser(userData) {
    if (userData.role === 'inactive' || userData.status === 'inactive') {
        console.log('⛔ ผู้ใช้ถูกระงับ');
        showSuspendedMessage(userData.displayName);
        
    } else if (userData.role === 'pending' || userData.department === 'รออนุมัติ') {
        console.log('⏳ ผู้ใช้รออนุมัติ');
        checkExistingRequest(userData.userId).then(hasRequest => {
            if (hasRequest) {
                showPendingMessage(userData, true);
            } else {
                showRegistrationForm();
            }
        });
        
    } else {
        console.log('✅ ผู้ใช้อนุมัติแล้ว');
        showNormalUI(userData);
    }
}

// ===== ฟังก์ชันจัดการรูปภาพ =====
function clearPhoto() {
    const photoInput = document.getElementById('mileagePhoto');
    const preview = document.getElementById('preview');
    const photoInfo = document.getElementById('photo-info');
    const removeBtn = document.querySelector('.remove-photo');
    
    if (photoInput) photoInput.value = '';
    if (preview) {
        preview.classList.remove('show');
        preview.src = '';
    }
    if (photoInfo) {
        photoInfo.classList.remove('show');
        photoInfo.innerHTML = '';
    }
    if (removeBtn) {
        removeBtn.style.display = 'none';
    }
}

// ===== ฟังก์ชันจัดการ FAB Menu =====
function toggleFabMenu() {
    const fabMenu = document.getElementById('fabMenu');
    if (fabMenu) {
        fabMenu.classList.toggle('open');
    }
}

function centerMap() {
    if (map) {
        map.panTo(originLatLng);
        map.setZoom(12);
        updateMapStatus('กลับไปยังจุดเริ่มต้น');
        
        const fabMenu = document.getElementById('fabMenu');
        if (fabMenu) {
            fabMenu.classList.remove('open');
        }
    }
}

function clearAllMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    updateSelectedDestinationsText();
    calculateRouteAndDistance();
    updateMapStatus('ล้างจุดหมายทั้งหมดแล้ว');
    
    const fabMenu = document.getElementById('fabMenu');
    if (fabMenu) {
        fabMenu.classList.remove('open');
    }
}

let mapType = 'roadmap';
function toggleMapType() {
    if (map) {
        mapType = mapType === 'roadmap' ? 'satellite' : 'roadmap';
        map.setMapTypeId(mapType);
        updateMapStatus(`เปลี่ยนเป็นแผนที่แบบ ${mapType === 'roadmap' ? 'ถนน' : 'ดาวเทียม'}`);
        
        const fabMenu = document.getElementById('fabMenu');
        if (fabMenu) {
            fabMenu.classList.remove('open');
        }
    }
}

// ===== ฟังก์ชันจัดการปลายทาง =====
function updateSelectedDestinationsText() {
    const el = document.getElementById("selectedDestinations");
    if (el) {
        if (markers.length === 0) {
            el.innerText = "กรุณาคลิกเลือกจุดบนแผนที่";
        } else {
            el.innerText = markers.map((m, i) =>
                `📍 จุดที่ ${i + 1}: ${m.getPosition().lat().toFixed(5)}, ${m.getPosition().lng().toFixed(5)}`
            ).join("\n");
        }
    }
    clearError('destinations');
}

// ✅ ฟังก์ชันคำนวณเส้นทาง
function calculateRouteAndDistance() {
    if (markers.length === 0) {
        if (directionsRenderer) {
            directionsRenderer.set('directions', null);
        }
        const routeInfo = document.getElementById("routeInfo");
        if (routeInfo) {
            routeInfo.innerHTML = `
                <i class="fas fa-route"></i>
                <div class="route-details">
                    <div class="route-distance">
                        <i class="fas fa-road"></i>
                        <span>รอการเลือกปลายทาง...</span>
                    </div>
                </div>
            `;
        }
        return;
    }

    const waypoints = markers.map(marker => ({
        location: marker.getPosition(),
        stopover: true,
    }));

    const destination = waypoints[waypoints.length - 1].location;
    const midpoints = waypoints.slice(0, waypoints.length - 1);

    if (!directionsService || !directionsRenderer) return;

    directionsService.route({
        origin: originLatLng,
        destination,
        waypoints: midpoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
    }, (response, status) => {
        const routeInfo = document.getElementById("routeInfo");
        if (!routeInfo) return;
        
        if (status === 'OK') {
            directionsRenderer.setDirections(response);
            let totalDistance = 0;
            let totalDuration = 0;

            response.routes[0].legs.forEach(leg => {
                totalDistance += leg.distance.value;
                totalDuration += leg.duration.value;
            });

            const km = (totalDistance / 1000).toFixed(2);
            const minutes = Math.round(totalDuration / 60);
            
            routeInfo.innerHTML = `
                <i class="fas fa-route"></i>
                <div class="route-details">
                    <div class="route-distance">
                        <i class="fas fa-road"></i>
                        <span>🛣️ ระยะทางรวม: ${km} กม.</span>
                    </div>
                    <div class="route-time">
                        <i class="fas fa-clock"></i>
                        <span>⏱ เวลาโดยประมาณ: ${minutes} นาที</span>
                    </div>
                </div>
            `;
        } else {
            routeInfo.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <div class="route-details">
                    <div class="route-distance">
                        <span>❌ ไม่สามารถคำนวณเส้นทางได้</span>
                    </div>
                </div>
            `;
            console.error('Directions request failed:', status);
        }
    });
}

// ฟังก์ชันสร้าง marker
function createMarker(position) {
    if (!map) return null;
    
    try {
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            icon: {
                url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                scaledSize: new google.maps.Size(32, 32)
            },
            title: `จุดที่ ${markers.length + 1}`,
            animation: google.maps.Animation.DROP
        });
        
        marker.addListener('click', () => {
            marker.setMap(null);
            markers = markers.filter(m => m !== marker);
            updateSelectedDestinationsText();
            calculateRouteAndDistance();
            updateMapStatus(`ลบจุดที่ ${markers.indexOf(marker) + 1} แล้ว`);
        });
        
        return marker;
    } catch (error) {
        console.error('Error creating marker:', error);
        return null;
    }
}

// ===== ฟังก์ชันตรวจสอบและเพิ่ม Auto Destination =====
function checkAndAddAutoDestination(userData) {
    if (!map || !markers) {
        console.log('⏳ Map ยังไม่พร้อม รอไว้ทีหลัง');
        return false;
    }
    
    if (!userData || userData.userId !== CONFIG.autoDestination.userId) {
        return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const startTime = CONFIG.autoDestination.startTime;
    const endTime = CONFIG.autoDestination.endTime;
    
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const startTotalMinutes = startTime.hour * 60 + startTime.minute;
    const endTotalMinutes = endTime.hour * 60 + endTime.minute;
    
    if (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes) {
        console.log('⏰ อยู่ในช่วงเวลาที่กำหนด เพิ่ม Auto Destination');
        
        if (markers.length < 3) {
            const location = CONFIG.autoDestination.location;
            
            try {
                const marker = createMarker(new google.maps.LatLng(location.lat, location.lng));
                markers.push(marker);
                map.panTo(location);
                updateSelectedDestinationsText();
                calculateRouteAndDistance();
                updateMapStatus('📍 เพิ่ม Auto Destination เรียบร้อย');
                showNotification('📍 เพิ่มจุดหมายอัตโนมัติในช่วงเวลา 16:40-17:20 น.', 'info');
                return true;
            } catch (error) {
                console.error('❌ ไม่สามารถเพิ่ม Auto Destination:', error);
                return false;
            }
        } else {
            console.log('⚠️ ไม่สามารถเพิ่ม Auto Destination ได้เนื่องจากมีครบ 3 จุดแล้ว');
            return false;
        }
    }
    return false;
}

// ===== ฟังก์ชันจัดการ Google Maps =====
function loadGoogleMaps() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve();
            return;
        }

        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
            const checkInterval = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.googleMapsKey}&libraries=places&loading=async&callback=initMap`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            const checkGoogle = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkGoogle);
                    resolve();
                }
            }, 100);
        };
        
        script.onerror = () => {
            reject(new Error('Failed to load Google Maps API'));
        };
        
        document.head.appendChild(script);
    });
}

async function initMap() {
    if (mapInitialized) return true;
    
    try {
        showLoading(true);
        updateMapStatus('กำลังโหลดแผนที่...');
        
        await loadGoogleMaps();
        
        if (!window.google || !window.google.maps) {
            throw new Error('Google Maps API not loaded');
        }
        
        const mapElement = document.getElementById("map");
        if (!mapElement) {
            throw new Error('Map element not found');
        }
        
        map = new google.maps.Map(mapElement, {
            center: originLatLng,
            zoom: 12,
            mapTypeId: 'roadmap',
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "on" }]
                }
            ],
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false
        });

        directionsRenderer = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#2ECC71',
                strokeWeight: 4
            }
        });
        
        directionsService = new google.maps.DirectionsService();

        await new Promise((resolve) => {
            google.maps.event.addListenerOnce(map, 'tilesloaded', resolve);
        });

        new google.maps.Marker({
            position: originLatLng,
            map: map,
            title: "จุดเริ่มต้น",
            icon: {
                url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                scaledSize: new google.maps.Size(40, 40)
            }
        });

        const searchInput = document.getElementById("search-input");
        if (searchInput) {
            autocomplete = new google.maps.places.Autocomplete(searchInput, {
                types: ['establishment', 'geocode'],
                componentRestrictions: { country: 'th' }
            });
            autocomplete.bindTo('bounds', map);

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (!place.geometry || !place.geometry.location) {
                    updateMapStatus('ไม่พบพิกัดของสถานที่นี้', true);
                    return;
                }

                if (markers.length >= 3) {
                    updateMapStatus('เลือกได้สูงสุด 3 จุด', true);
                    return;
                }

                const location = place.geometry.location;
                const marker = createMarker(location);
                if (marker) {
                    markers.push(marker);
                    map.panTo(location);
                    updateSelectedDestinationsText();
                    calculateRouteAndDistance();
                    updateMapStatus(`เพิ่มจุดที่ ${markers.length}: ${place.name || 'สถานที่เลือก'}`);
                }
                
                searchInput.value = '';
            });
        }

        map.addListener("click", (e) => {
            if (markers.length >= 3) {
                updateMapStatus('เลือกได้สูงสุด 3 จุด', true);
                return;
            }

            const marker = createMarker(e.latLng);
            if (marker) {
                markers.push(marker);
                updateSelectedDestinationsText();
                calculateRouteAndDistance();
                updateMapStatus(`เพิ่มจุดที่ ${markers.length} จากแผนที่`);
            }
        });

        mapInitialized = true;
        updateMapStatus('แผนที่พร้อมใช้งานแล้ว');
        showLoading(false);
        return true;

    } catch (error) {
        console.error('Failed to initialize map:', error);
        updateMapStatus('ไม่สามารถโหลดแผนที่ได้', true);
        showLoading(false);
        return false;
    }
}

// ===== ฟังก์ชันสร้าง Flex Message =====
function createFlexMessage(name, phone, car, mileage, reason, markers, routeText, photoBase64) {
    const distanceMatch = routeText.match(/ระยะทางรวม:\s*([\d.]+)\s*กม/);
    const timeMatch = routeText.match(/เวลาโดยประมาณ:\s*(\d+)\s*นาที/);
    
    const distance = distanceMatch ? distanceMatch[1] : '0';
    const time = timeMatch ? timeMatch[1] : '0';

    return {
        type: "flex",
        altText: `🚗 บันทึกการใช้รถโดย ${name}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "🚗 บันทึกการใช้รถ",
                        weight: "bold",
                        size: "xl",
                        color: "#FFFFFF",
                        align: "center"
                    }
                ],
                backgroundColor: "#2ECC71",
                paddingAll: "15px"
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        contents: [
                            { type: "text", text: `👤 ชื่อ: ${name}`, wrap: true, size: "md" },
                            { type: "text", text: `📞 เบอร์โทร: ${phone}`, wrap: true, size: "md" },
                            { type: "text", text: `🚘 ทะเบียนรถ: ${car}`, wrap: true, size: "md" },
                            { type: "text", text: `📍 ไมล์รถ: ${mileage}`, wrap: true, size: "md" },
                            { type: "text", text: `📝 สาเหตุ: ${reason}`, wrap: true, size: "md" }
                        ]
                    },
                    { type: "separator", margin: "md" },
                    { type: "text", text: "📌 ปลายทาง:", weight: "bold", size: "md", margin: "md" },
                    ...markers.map((m, i) => ({
                        type: "text",
                        text: `• จุดที่ ${i + 1}: ${m.getPosition().lat().toFixed(5)}, ${m.getPosition().lng().toFixed(5)}`,
                        size: "sm",
                        wrap: true,
                        margin: "xs",
                        color: "#666666"
                    })),
                    { type: "separator", margin: "md" },
                    {
                        type: "box",
                        layout: "horizontal",
                        spacing: "md",
                        margin: "md",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    { type: "text", text: "🛣️ ระยะทาง", size: "xs", color: "#999999" },
                                    { type: "text", text: `${distance} กม.`, size: "lg", weight: "bold", color: "#2ECC71" }
                                ]
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    { type: "text", text: "⏱ เวลา", size: "xs", color: "#999999" },
                                    { type: "text", text: `${time} นาที`, size: "lg", weight: "bold", color: "#2ECC71" }
                                ]
                            }
                        ]
                    },
                    {
                        type: "text",
                        text: photoBase64 ? "📸 แนบรูปเลขไมล์เรียบร้อย" : "⚠️ ไม่มีรูปเลขไมล์แนบ",
                        color: photoBase64 ? "#2ECC71" : "#E74C3C",
                        size: "sm",
                        margin: "md",
                        align: "center"
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        action: {
                            type: "uri",
                            label: "📊 ดูประวัติการใช้งานรถ",
                            uri: "https://car-log-history.netlify.app/"
                        },
                        style: "primary",
                        color: "#2ECC71"
                    }
                ]
            }
        }
    };
}

// ===== ฟังก์ชันบันทึกข้อมูล =====
async function saveToDatabase(recordData) {
    try {
        const response = await fetch('/.netlify/functions/save-record', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recordData)
        }).catch(() => ({ ok: false }));

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Database save error:', error);
        return false;
    }
}

// ✅ ฟังก์ชันตรวจสอบฟอร์ม
function validateForm(car, mileage, reason, markers) {
    const errors = [];
    
    if (!car) errors.push({ field: 'car', message: 'กรุณาเลือกทะเบียนรถ' });
    if (!mileage || !/^\d+(\.\d{1,2})?$/.test(mileage)) errors.push({ field: 'mileage', message: 'กรุณากรอกเลขไมล์ให้ถูกต้อง' });
    if (!reason) errors.push({ field: 'reason', message: 'กรุณากรอกสาเหตุการใช้รถ' });
    if (markers.length === 0) errors.push({ field: 'destinations', message: 'กรุณาเลือกปลายทางอย่างน้อย 1 จุด' });
    
    return errors;
}

// ===== ฟังก์ชันจัดการ Popup =====
function closePopup() {
    const popup = document.getElementById("popupModal");
    if (popup) {
        popup.classList.remove("show");
        setTimeout(() => {
            resetForm();
        }, 500);
    }
}

// ✅ ฟังก์ชัน resetForm
function resetForm() {
    const form = document.getElementById("field-form");
    if (form) form.reset();
    
    clearPhoto();
    
    ['car', 'mileage', 'reason', 'destinations'].forEach(clearError);
    
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    updateSelectedDestinationsText();
    calculateRouteAndDistance();
    
    updateMapStatus('ล้างข้อมูลเรียบร้อย');
}

// ===== Main form submit (เวอร์ชันปรับปรุง: เริ่มใช้รถแทนการปิดหน้า) =====
document.getElementById('field-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // ✅ ตรวจสอบว่ารถกำลังถูกใช้อยู่หรือไม่
    if (!canScanCar()) {
        return;
    }
    
    if (currentUser && (currentUser.role === 'pending' || currentUser.role === 'inactive')) {
        showNotification('⚠️ ไม่สามารถบันทึกข้อมูลได้ เนื่องจากบัญชีของคุณยังไม่ได้รับการอนุมัติหรือถูกระงับ', 'warning');
        return;
    }
    
    const submitBtn = document.getElementById("submit-btn");
    if (!submitBtn) return;
    
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังส่ง...';
        
        const name = currentUser?.mappedName || currentUser?.displayName || 'ไม่ระบุชื่อ';
        const phone = currentUser?.phone || 'ไม่มีเบอร์';
        const car = document.getElementById("car")?.value;
        const carModel = car ? car.split(' : ')[0] : '';
        const carPlate = car ? car : '';
        const mileage = document.getElementById("mileage")?.value;
        const reason = document.getElementById("reason")?.value;
        const routeInfo = document.getElementById("routeInfo");
        const routeText = routeInfo ? routeInfo.innerText : '';
        const photoFile = document.getElementById("mileagePhoto")?.files[0];

        const errors = validateForm(car, mileage, reason, markers);
        if (errors.length > 0) {
            errors.forEach(error => {
                showError(error.field, error.message);
            });
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        const recordData = {
            name: currentUser?.mappedName || 'ไม่ระบุชื่อ',
            phone: currentUser?.phone || 'ไม่มีเบอร์',
            car,
            mileage,
            reason,
            routeText,
            destinations: markers.map((m, i) => ({
                point: i + 1,
                lat: m.getPosition().lat(),
                lng: m.getPosition().lng()
            })),
            totalDistance: routeText.includes('กม.') ? 
                parseFloat(routeText.split('กม.')[0].split(':')[1].trim()) : 0,
            totalTime: routeText.includes('นาที') ? 
                parseInt(routeText.split('นาที')[0].split(':')[2].trim()) : 0,
            userId: currentUser?.userId || 'unknown',
            displayName: currentUser?.mappedName || 'ไม่ระบุชื่อ',
            timestamp: new Date().toISOString(),
            isAutoDestination: currentUser?.userId === CONFIG.autoDestination.userId && 
                              markers.length >= 1 && 
                              markers.some(m => 
                                  Math.abs(m.getPosition().lat() - CONFIG.autoDestination.location.lat) < 0.0001 &&
                                  Math.abs(m.getPosition().lng() - CONFIG.autoDestination.location.lng) < 0.0001
                              )
        };

        const sendData = async (photoBase64) => {
            const message = createFlexMessage(
                recordData.name,
                recordData.phone,
                car, 
                mileage, 
                reason, 
                markers, 
                routeText, 
                photoBase64
            );
            
            let shareResult = true;
            if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
                try {
                    shareResult = await liff.shareTargetPicker([message]);
                } catch (shareError) {
                    console.log('Share cancelled or failed:', shareError);
                    shareResult = false;
                }
            } else {
                console.log('Preview message:', message);
                showNotification('📤 ข้อมูลพร้อมส่ง (Preview mode)', 'info');
            }
            
            if (shareResult) {
                const recordWithPhoto = {
                    ...recordData,
                    hasPhoto: !!photoBase64,
                    photoSize: photoBase64 ? photoBase64.length : 0
                };
                
                const saved = await saveToDatabase(recordWithPhoto);
                if (saved) {
                    console.log('✅ บันทึกข้อมูลสำเร็จ');
                } else {
                    console.warn('⚠️ บันทึกข้อมูลไม่สำเร็จ');
                }
            }
            
            return shareResult;
        };

        let result;
        if (photoFile) {
            updateMapStatus('กำลังอัปโหลดรูปภาพ...');
            
            const reader = new FileReader();
            result = await new Promise((resolve) => {
                reader.onloadend = () => resolve(sendData(reader.result));
                reader.readAsDataURL(photoFile);
            });
        } else {
            result = await sendData(null);
        }

        if (result) {
            // ✅ สำเร็จ → เริ่มใช้รถ (แทนการปิดหน้า)
            startUsingCar(carPlate, carModel, name, currentUser?.userId, mileage);
            
            // แจ้งเตือนสำเร็จ
            showNotification(`✅ บันทึกสำเร็จ! กำลังใช้รถ ${carPlate}`, 'success');
            
            // ❌ ไม่ปิดหน้า ไม่มี popup นับถอยหลัง
            // แต่จะขึ้นหน้า "กำลังใช้รถ" แทน (ใน startUsingCar)
        }

    } catch (error) {
        console.error('Submission error:', error);
        updateMapStatus('❌ เกิดข้อผิดพลาด กรุณาลองใหม่', true);
        showNotification('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองอีกครั้ง', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// ===== ฟังก์ชันหลักในการเริ่มต้นแอป =====
async function initializeApp() {
    try {
        showLoading(true);
        
        // โหลดสถานะการใช้รถ
        loadCarUsageState();
        
        const env = checkEnvironment();
        
        if (typeof liff !== 'undefined') {
            try {
                await liff.init({ liffId: CONFIG.liffId });
                console.log('✅ LIFF initialized');
                
                if (!liff.isLoggedIn()) {
                    console.log('🔑 กำลัง login...');
                    liff.login();
                    return;
                }
                
                const profile = await liff.getProfile();
                const context = liff.getContext();
                
                let userData = {
                    userId: profile.userId,
                    displayName: profile.displayName,
                    pictureUrl: profile.pictureUrl,
                    context: context,
                    timestamp: new Date().toISOString(),
                    environment: env,
                    userAgent: navigator.userAgent
                };
                
                console.log('📥 กำลังโหลดข้อมูลผู้ใช้จาก JSONBin...');
                const jsonBinData = await loadJSONBin(JSONBIN_CONFIG.userBinId, true);
                
                if (jsonBinData && jsonBinData[profile.userId]) {
                    const userFromJson = jsonBinData[profile.userId];
                    console.log('✅ พบข้อมูลจาก JSONBin:', userFromJson);
                    
                    userData.mappedName = userFromJson.name || profile.displayName;
                    userData.phone = userFromJson.phone || '';
                    userData.department = userFromJson.department || 'พนักงาน';
                    userData.role = userFromJson.role || 'user';
                    userData.status = userFromJson.status || 'active';
                    
                } else {
                    userData.mappedName = profile.displayName;
                    userData.phone = '';
                    userData.department = 'รออนุมัติ';
                    userData.role = 'pending';
                    userData.status = 'pending';
                    
                    console.log('👤 พบผู้ใช้ใหม่:', profile.displayName);
                }
                
                currentUser = userData;
                
                await callNetlifyFunction('log-login', userData);
                
                // ✅ อัปเดตรูปโปรไฟล์ (ถ้ามีการเปลี่ยนแปลง)
                await updateUserProfilePicture();
                
                // ถ้ากำลังใช้รถอยู่ ให้แสดงหน้าคืนรถ
                if (currentCarUsage.isUsing) {
                    showCarInUseScreen();
                } else {
                    updateUIForUser(userData);
                }
                
            } catch (liffError) {
                console.error('LIFF initialization failed:', liffError);
                showManualLoginForm();
            }
        } else {
            console.log('⚠️ LIFF SDK not loaded');
            showManualLoginForm();
        }
        
        console.log('🗺️ กำลังโหลดแผนที่...');
        const mapLoaded = await initMap();
        if (!mapLoaded) {
            console.warn('⚠️ แผนที่โหลดไม่สำเร็จ');
        }
        
        if (currentUser && currentUser.role !== 'pending' && currentUser.role !== 'inactive' && !currentCarUsage.isUsing) {
            setTimeout(() => {
                checkAndAddAutoDestination(currentUser);
            }, 2000);
        }
        
        console.log('✅ แอปพลิเคชันพร้อมใช้งาน');
        showLoading(false);
        
    } catch (error) {
        console.error('Application initialization failed:', error);
        showLoading(false);
        showManualLoginForm();
        showNotification('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM พร้อมแล้ว');
    
    const mileagePhoto = document.getElementById('mileagePhoto');
    if (mileagePhoto) {
        mileagePhoto.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const photoInfo = document.getElementById('photo-info');
            const preview = document.getElementById('preview');
            const removeBtn = document.querySelector('.remove-photo');
            
            if (!file) {
                clearPhoto();
                return;
            }

            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 5 * 1024 * 1024;

            if (!validTypes.includes(file.type)) {
                if (photoInfo) {
                    photoInfo.innerHTML = '<i class="fas fa-exclamation-circle"></i> กรุณาเลือกไฟล์ภาพ (JPG, PNG, GIF, WEBP)';
                    photoInfo.style.color = '#E74C3C';
                    photoInfo.classList.add('show');
                }
                e.target.value = '';
                return;
            }

            if (file.size > maxSize) {
                if (photoInfo) {
                    photoInfo.innerHTML = '<i class="fas fa-exclamation-circle"></i> ไฟล์ภาพต้องมีขนาดไม่เกิน 5MB';
                    photoInfo.style.color = '#E74C3C';
                    photoInfo.classList.add('show');
                }
                e.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                if (preview) {
                    preview.src = event.target.result;
                    preview.classList.add("show");
                }
                if (removeBtn) {
                    removeBtn.style.display = 'flex';
                }
                if (photoInfo) {
                    photoInfo.innerHTML = `<i class="fas fa-check-circle"></i> เลือกไฟล์: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                    photoInfo.style.color = '#2ECC71';
                    photoInfo.classList.add('show');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    const removePhotoBtn = document.querySelector('.remove-photo');
    if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', clearPhoto);
    }

    const mileage = document.getElementById('mileage');
    if (mileage) {
        mileage.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value && !/^\d+(\.\d{0,2})?$/.test(value)) {
                showError('mileage', 'กรุณากรอกเลขไมล์ให้ถูกต้อง');
            } else {
                clearError('mileage');
            }
        });
    }

    const reason = document.getElementById('reason');
    if (reason) {
        reason.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                clearError('reason');
            }
        });
    }

    const carSelect = document.getElementById('car');
    if (carSelect) {
        carSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                clearError('car');
            }
        });
    }

    document.addEventListener('click', function(event) {
        const fabMenu = document.getElementById('fabMenu');
        if (fabMenu && !fabMenu.contains(event.target) && fabMenu.classList.contains('open')) {
            fabMenu.classList.remove('open');
        }
    });

    const otherDeptGroup = document.getElementById('reg-other-dept')?.parentElement?.parentElement;
    if (otherDeptGroup) {
        otherDeptGroup.style.display = 'none';
    }

    document.getElementById('reg-department')?.addEventListener('change', function(e) {
        const otherDeptGroup = document.getElementById('reg-other-dept').parentElement.parentElement;
        if (e.target.value === 'อื่นๆ') {
            otherDeptGroup.style.display = 'block';
            document.getElementById('reg-other-dept').required = true;
        } else {
            otherDeptGroup.style.display = 'none';
            document.getElementById('reg-other-dept').required = false;
        }
    });
});

// Registration form submit
document.getElementById('register-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('register-btn');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังส่ง...';
        
        const fullName = document.getElementById('reg-name').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const department = document.getElementById('reg-department').value;
        const otherDept = document.getElementById('reg-other-dept').value.trim();
        
        if (!fullName) {
            showError('reg-name', 'กรุณากรอกชื่อ-นามสกุล');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
        
        if (!phone || !/^[0-9]{10}$/.test(phone)) {
            showError('reg-phone', 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
        
        if (!department) {
            showError('reg-department', 'กรุณาเลือกแผนก');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
        
        if (department === 'อื่นๆ' && !otherDept) {
            showError('reg-other-dept', 'กรุณาระบุแผนก');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
        
        if (!currentUser || !currentUser.userId) {
            throw new Error('ไม่พบข้อมูลผู้ใช้');
        }
        
        const formData = {
            fullName,
            phone,
            department: department === 'อื่นๆ' ? otherDept : department,
            otherDepartment: department === 'อื่นๆ' ? otherDept : null
        };
        
        const result = await submitRegistration(
            currentUser.userId,
            currentUser.displayName,
            currentUser.pictureUrl,
            formData
        );
        
        if (!result) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('เกิดข้อผิดพลาด: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// เริ่มต้นแอป
window.onload = initializeApp;