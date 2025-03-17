const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Tạo danh sách lưu URL đã tải
const downloadedImages = new Set();
const downloadFolder = path.join(__dirname, "images");
if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);

// Hàm tải ảnh
async function downloadImage(url, index) {
  if (downloadedImages.has(url)) return; // Bỏ qua nếu trùng

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const imagePath = path.join(downloadFolder, `image_${index}.jpg`);
    fs.writeFileSync(imagePath, response.data);
    downloadedImages.add(url);
    console.log(`✅ Đã tải ảnh: ${imagePath}`);
  } catch (error) {
    console.error(`❌ Lỗi tải ảnh ${url}: `, error.message);
  }
}

// Hàm lấy URL ảnh trên trang
async function getImageUrls(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img"))
      .map(img => img.src || img.getAttribute("data-src"))
      .filter(url => url && url.startsWith("https"));
  });
}

// Hàm tự động cuộn + tải ảnh theo từng lần cuộn
async function autoScroll(page, scrollCount = 50) {
  let totalImages = 0;

  for (let i = 0; i < scrollCount; i++) {
    console.log(`🔄 Cuộn lần ${i + 1}/${scrollCount}...`);

    // Lấy URL ảnh hiện tại trên trang
    const imageUrls = await getImageUrls(page);
    
    // Tải từng ảnh
    for (const url of imageUrls) {
      await downloadImage(url, totalImages);
      totalImages++;
    }

    // Cuộn xuống
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(resolve => setTimeout(resolve, 1000)); // Đợi ảnh tải xong
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    // args: [
    //   "--disable-gpu",
    //   "--disable-software-rasterizer",
    //   "--disable-dev-shm-usage",
    //   "--no-sandbox",
    //   "--disable-setuid-sandbox",
    //   "--window-size=1920,1080"
    // ]
  });

  const page = await browser.newPage();

  // Fake User-Agent để tránh bị chặn
//   await page.setUserAgent(
//     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
//   );

  const url = "https://www.pinterest.com/search/pins/?q=Japanese%20Girl&rs=typed";
  await page.goto(url, { waitUntil: "load", timeout: 0 });

  // Chạy cuộn và tải ảnh
  await autoScroll(page, 50);

  await browser.close();
})();
