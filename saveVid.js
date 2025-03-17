const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Tạo thư mục lưu video
const downloadFolder = path.join(__dirname, "videos");
if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);

// Lưu danh sách video đã tải để tránh trùng lặp
const downloadedVideos = new Set();

// Hàm tải video từ URL gốc
async function downloadVideo(url, index) {
  if (downloadedVideos.has(url)) return; // Bỏ qua nếu đã tải

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const videoPath = path.join(downloadFolder, `video_${index}.mp4`);
    fs.writeFileSync(videoPath, response.data);
    downloadedVideos.add(url);
    console.log(`✅ Đã tải video: ${videoPath}`);
  } catch (error) {
    console.error(`❌ Lỗi tải video ${url}:`, error.message);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Để xem request trong DevTools
    args: ["--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  // Fake User-Agent để tránh bị chặn
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
  );

  const url = "https://www.pinterest.com/search/videos/?q=Japanese%20Girl&rs=content_type_filter";
  await page.goto(url, { waitUntil: "load", timeout: 0 });

  // Lưu lại request video thật sự
  let videoUrls = [];
  page.on("request", (request) => {
    const requestUrl = request.url();
    if (requestUrl.includes(".mp4") && !downloadedVideos.has(requestUrl)) {
      console.log(`🎥 Video URL tìm thấy: ${requestUrl}`);
      videoUrls.push(requestUrl);
      downloadedVideos.add(requestUrl);
    }
  });

  // Cuộn trang để load thêm video
  for (let i = 0; i < 50; i++) {
    console.log(`🔄 Cuộn lần ${i + 1}/50...`);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Chờ một chút để lấy hết request video
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Tải từng video từ URL gốc
  for (let i = 0; i < videoUrls.length; i++) {
    await downloadVideo(videoUrls[i], i);
  }

  await browser.close();
})();
