const fs = require('fs');
const puppeteer = require('puppeteer');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Kiểm tra và tạo file nếu không tồn tại
const ensureFileExists = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                fs.writeFile(filePath, '', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    });
};

// Đọc danh sách username từ file
const readUsernamesFromFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                // Chỉ lấy username (loại bỏ phần sau dấu ':')
                const usernames = data.split('\n')
                    .map(line => line.trim().split(':')[0]) // Chỉ lấy phần username trước dấu ':'
                    .filter(Boolean);
                resolve(usernames);
            }
        });
    });
};

// Ghi kết quả vào file
const writeResultToFile = (filePath, content) => {
    return new Promise((resolve, reject) => {
        fs.appendFile(filePath, content + '\n', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// Hàm chính để xử lý từng username
const handleRequests = async (usernames, restrictedFilePath, normalFilePath) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        const url = `https://www.tiktok.com/@${username}`;

        await page.goto(url, { waitUntil: 'networkidle2' });

        const isNormal = await page.evaluate(() => {
            const followButton = document.evaluate("//div[text()='Follow']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return followButton !== null;
        });

        if (isNormal) {
            console.log(`${username} Normal`);
            await writeResultToFile(normalFilePath, username);
        } else {
            console.log(`${username} bị Banned`);
            await writeResultToFile(restrictedFilePath, username);
           
        }
    }
    await browser.close();
};

// Mã cho các worker
if (!isMainThread) {
    if (workerData && workerData.usernames && workerData.usernames.length > 0) {
        handleRequests(
            workerData.usernames,
            workerData.restrictedFilePath,
            workerData.normalFilePath
        )
        .then(() => parentPort.postMessage('Done'))
        .catch(err => parentPort.postMessage({ error: err.message }));
    }
} else {
    // Mã cho thread chính
    (async () => {
        const filePath = './thong_tin/usernames.txt';
        const restrictedFilePath = './thong_tin/banned_accounts.txt';
        const normalFilePath = './thong_tin/normal_accounts.txt';

        try {
            const usernames = await readUsernamesFromFile(filePath);
            
            fs.writeFileSync(restrictedFilePath, '', 'utf8');
            fs.writeFileSync(normalFilePath, '', 'utf8');

            // Đảm bảo các file kết quả tồn tại
            await Promise.all([ 
                ensureFileExists(restrictedFilePath), 
                ensureFileExists(normalFilePath),
            ]);

            const numThreads = process.argv[2] ? parseInt(process.argv[2]) : 10;
            const proxiesPerThread = Math.ceil(usernames.length / numThreads);

            console.log(`-------------------------------------Creating ${numThreads} worker threads-------------------------------------`);

            const workers = [];

            for (let i = 0; i < numThreads; i++) {
                const start = i * proxiesPerThread;
                const end = Math.min(start + proxiesPerThread, usernames.length);
                const workerUsernames = usernames.slice(start, end);

                const worker = new Worker(__filename, {
                    workerData: {
                        usernames: workerUsernames,
                        restrictedFilePath,
                        normalFilePath
                    }
                });

                worker.on('message', (message) => {
                    if (message === 'Done') {
                        // console.log(`Worker ${i} completed.`);
                    } else if (message.error) {
                        console.error(`Worker ${i} error: ${message.error}`);
                    }
                });

                worker.on('error', (error) => {
                    console.error(`Error from worker ${i}: ${error.message}`);
                });

                worker.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Worker ${i} stopped with exit code ${code}`);
                    }
                });

                workers.push(worker);
            }

            // Chờ tất cả workers hoàn tất
            await Promise.all(workers.map(worker => new Promise(resolve => worker.on('exit', resolve))));

            console.log('Tất cả các kiểm tra đã hoàn tất.');
        } catch (error) {
            console.error(`Lỗi khi đọc file hoặc kiểm tra tài khoản: ${error.message}`);
        }
    })();
}
