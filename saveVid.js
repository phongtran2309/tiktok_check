const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Tạo thư mục lưu video
const downloadFolder = path.join(__dirname, "videos");
if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);

// Đường dẫn tới file video.txt
const videoTxtPath = path.join(__dirname, "video.txt");

// Đọc các URL video đã tải từ video.txt
function readDownloadedVideos() {
  if (fs.existsSync(videoTxtPath)) {
    const data = fs.readFileSync(videoTxtPath, "utf-8");
    return new Set(data.split("\n").filter(Boolean));
  }
  return new Set();
}

// Lưu URL video vào video.txt
function saveDownloadedVideo(url) {
  fs.appendFileSync(videoTxtPath, url + "\n");
}

// Hàm tải video
async function downloadVideo(url, index) {
  const downloadedVideos = readDownloadedVideos();

  if (downloadedVideos.has(url)) {
    console.log(`❌ Video ${url} đã tải rồi, bỏ qua.`);
    return; // Bỏ qua nếu đã tải
  }

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const videoPath = path.join(downloadFolder, `video_${index}.mp4`);
    fs.writeFileSync(videoPath, response.data);
    saveDownloadedVideo(url); // Lưu URL vào video.txt
    console.log(`✅ Đã tải video: ${videoPath}`);
  } catch (error) {
    console.error(`❌ Lỗi tải video ${url}: `, error.message);
  }
}

// Hàm lấy danh sách URL video từ trang
async function getVideoUrls(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("video"))
      .map(video => video.src || video.getAttribute("data-src"))
      .filter(url => url && url.startsWith("https"));
  });
}

// Hàm cuộn & tải video liên tục
async function autoScrollAndDownload(page, scrollCount = 50) {
  let totalVideos = 0;

  for (let i = 0; i < scrollCount; i++) {
    console.log(`🔄 Cuộn lần ${i + 1}/${scrollCount}...`);

    // Lấy URL video hiện tại
    const videoUrls = await getVideoUrls(page);

    // Tải từng video
    for (const url of videoUrls) {
      await downloadVideo(url, totalVideos);
      totalVideos++;
    }

    // Cuộn xuống
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(resolve => setTimeout(resolve, 1500)); // Chờ tải video
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080"
    ]
  });

  const page = await browser.newPage();

  // Fake User-Agent để tránh bị chặn
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
  );

  const url = "https://www.pexels.com/search/videos/japanese/";
  await page.goto(url, { waitUntil: "load", timeout: 0 });

  // Chạy cuộn & tải video
  await autoScrollAndDownload(page, 50);

  await browser.close();
})();
