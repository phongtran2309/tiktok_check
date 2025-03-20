const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SHEET_ID = '1Eo_Iowrwj9f4rSpst4mxpS7StBzOm9cl0SAAU6QA_ho'; // Thay thế bằng ID sheet của bạn
const BANNED_FILE = './thong_tin/banned_accounts.txt';

// Hàm đọc input từ người dùng
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(query, answer => {
        rl.close();
        resolve(answer.trim());
    }));
}

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

// Đọc danh sách users từ Google Sheet
async function getSheetData(auth, sheetName, columnE, columnF) {
    const sheets = google.sheets({ version: 'v4', auth });
    const range = `${sheetName}!${columnE}:${columnF}`;
    
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
    });
    return response.data.values || [];
}

// Cập nhật cột Status nếu user bị banned
async function updateSheet(auth, bannedAccounts, sheetName, columnE, columnF) {
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetData = await getSheetData(auth, sheetName, columnE, columnF);
    let updates = [];

    sheetData.forEach((row, index) => {
        const username = row[0]; // Cột User nhập vào
        if (bannedAccounts.includes(username)) {
            updates.push({
                range: `${sheetName}!${columnF}${index + 1}`,
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
    process.removeAllListeners('warning');

    try {
        const sheetName = await askQuestion('Nhập tên Sheet (mặc định: Tài): ') || 'Tài';
        const columnE = await askQuestion('Nhập cột User (mặc định: E): ') || 'E';
        const columnF = await askQuestion('Nhập cột Status (mặc định: F): ') || 'F';

        const auth = await authorize();
        const bannedAccounts = await readBannedAccounts();
        await updateSheet(auth, bannedAccounts, sheetName, columnE, columnF);
    } catch (err) {
        console.error('Lỗi:', err.message);
    }
})();
