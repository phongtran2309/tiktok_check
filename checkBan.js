const fs = require("fs");
const axios = require("axios");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { HttpsProxyAgent } = require("https-proxy-agent");

const NUM_THREADS = 10; // Số lượng worker

const readFileLines = (filePath) => {
    try {
        return fs.readFileSync(filePath, "utf8").split("\n").map(line => line.trim()).filter(Boolean);
    } catch (error) {
        console.error(`Lỗi khi đọc file ${filePath}:`, error.message);
        return [];
    }
};

const writeResultToFile = (filePath, content) => {
    return new Promise((resolve, reject) => {
        fs.appendFile(filePath, content + "\n", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const checkTikTokAccount = async (username, proxy, userAgent) => {
    try {
        const url = `https://www.tikwm.com/api/user/info?unique_id=${username}`;
        let httpsAgent = null;

        if (proxy) {
            let proxyUrl;
            const parts = proxy.split(":");
            
            if (parts.length === 4) {
                // Proxy có user:pass
                const [host, port, user, pass] = parts;
                proxyUrl = `http://${user}:${pass}@${host}:${port}`;
            } else if (parts.length === 2) {
                // Proxy không có user:pass
                const [host, port] = parts;
                proxyUrl = `http://${host}:${port}`;
            } else {
                throw new Error(`Proxy không hợp lệ: ${proxy}`);
            }

            httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

        const response = await axios.get(url, {
            headers: { "User-Agent": userAgent },
            httpsAgent,
        });

        if (!response.data || !response.data.data || !response.data.data.user) {
            return { username, status: "Error", reason: "Invalid API response" };
        }

        const userData = response.data.data.user;
        if (userData.general_permission?.profile_toast) {
            console.log(`${username} Banned, Reason: ${userData.general_permission.profile_toast}`);
            return { username, status: "Banned", reason: userData.general_permission.profile_toast };
        }
        console.log(`${username} Normal`);

        return { username, status: "Normal" };
    } catch (error) {
        return { username, status: "Error", reason: error.message };
    }
};


if (!isMainThread) {
    (async () => {
        const { usernames, proxies, userAgents, restrictedFilePath, normalFilePath, errorFilePath } = workerData;

        for (let i = 0; i < usernames.length; i++) {
            const proxy = proxies[i % proxies.length];
            const userAgent = userAgents[i % userAgents.length];
            const result = await checkTikTokAccount(usernames[i], proxy, userAgent);
            
            if (result.status === "Banned") {
                await writeResultToFile(restrictedFilePath, `${result.username} - ${result.reason}`);
            } else if (result.status === "Normal") {
                await writeResultToFile(normalFilePath, result.username);
            } else {
                await writeResultToFile(errorFilePath, `${result.username} - Lỗi: ${result.reason}`);
            }
        }
        parentPort.postMessage("Done");
    })();
} else {
    (async () => {
        const usernames = readFileLines("./thong_tin/usernames.txt");
        const proxies = readFileLines("./thong_tin/proxy.txt");
        const userAgents = readFileLines("./thong_tin/userAgents.txt");

        if (usernames.length === 0 || proxies.length === 0 || userAgents.length === 0) {
            throw new Error("Danh sách usernames, proxies hoặc user-agents bị thiếu.");
        }

        const restrictedFilePath = "./thong_tin/banned_accounts.txt";
        const normalFilePath = "./thong_tin/normal_accounts.txt";
        const errorFilePath = "./thong_tin/error.txt";
        fs.writeFileSync(restrictedFilePath, "", "utf8");
        fs.writeFileSync(normalFilePath, "", "utf8");
        fs.writeFileSync(errorFilePath, "", "utf8");

        const batchSize = Math.ceil(usernames.length / NUM_THREADS);
        const proxyBatchSize = Math.ceil(proxies.length / NUM_THREADS);
        const userAgentBatchSize = Math.ceil(userAgents.length / NUM_THREADS);

        console.log(`Chia thành ${NUM_THREADS} worker threads để xử lý`);

        const workers = [];
        for (let i = 0; i < NUM_THREADS; i++) {
            const workerUsernames = usernames.slice(i * batchSize, (i + 1) * batchSize);
            const workerProxies = proxies.slice(i * proxyBatchSize, (i + 1) * proxyBatchSize);
            const workerUserAgents = userAgents.slice(i * userAgentBatchSize, (i + 1) * userAgentBatchSize);

            if (workerUsernames.length === 0) continue;

            const worker = new Worker(__filename, {
                workerData: {
                    usernames: workerUsernames,
                    proxies: workerProxies.length > 0 ? workerProxies : proxies,
                    userAgents: workerUserAgents.length > 0 ? workerUserAgents : userAgents,
                    restrictedFilePath,
                    normalFilePath,
                    errorFilePath
                },
            });

            worker.on("message", (message) => {
                if (message !== "Done") console.error(`Lỗi từ worker: ${message}`);
            });
            worker.on("error", (err) => console.error(`Worker lỗi: ${err.message}`));
            worker.on("exit", (code) => {
                if (code !== 0) console.error(`Worker dừng với mã lỗi ${code}`);
            });

            workers.push(worker);
        }
        await Promise.all(workers.map(worker => new Promise(resolve => worker.on("exit", resolve))));
        console.log("Kiểm tra hoàn tất.");
    })();
}
