const fs = require('fs');
const { google } = require('googleapis');

const SHEET_ID = '1Eo_Iowrwj9f4rSpst4mxpS7StBzOm9cl0SAAU6QA_ho'; // Thay thế bằng ID sheet của bạn
const SHEET_NAME = 'Tài';
const COLUMN_E = 'E';
const COLUMN_F = 'F';
const BANNED_FILE = './thong_tin/banned_accounts.txt';

// Xác thực Google Sheets API
async function authorize() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return auth.getClient();
}

// Đọc danh sách banned từ file
function readBannedAccounts() {
    return new Promise((resolve, reject) => {
        fs.readFile(BANNED_FILE, 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(data.split('\n').map(line => line.trim()).filter(Boolean));
        });
    });
}

// Đọc danh sách users từ cột E của Google Sheet
async function getSheetData(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    const range = `${SHEET_NAME}!${COLUMN_E}:${COLUMN_F}`;
    
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
    });
    return response.data.values || [];
}

// Cập nhật cột F nếu user bị banned
async function updateSheet(auth, bannedAccounts) {
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetData = await getSheetData(auth);
    let updates = [];

    sheetData.forEach((row, index) => {
        const username = row[0]; // Cột E chứa username
        if (bannedAccounts.includes(username)) {
            updates.push({
                range: `${SHEET_NAME}!${COLUMN_F}${index + 1}`,
                values: [['Banned']]
            });
        }
    });

    if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SHEET_ID,
            resource: {
                data: updates,
                valueInputOption: 'RAW',
            },
        });
        console.log('Cập nhật thành công!');
    } else {
        console.log('Không có tài khoản nào cần cập nhật.');
    }
}

// Chạy chương trình
(async () => {
    try {
        const auth = await authorize();
        const bannedAccounts = await readBannedAccounts();
        await updateSheet(auth, bannedAccounts);
    } catch (err) {
        console.error('Lỗi:', err.message);
    }
})();
