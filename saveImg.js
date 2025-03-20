const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_KEY = "bP9KKZzUS9ZjyjFXHM3Oiq9JkfpjOkkPQd8SmNJtf3z5NS9DxJKEK3Uf";
const QUERY = "Japanese woman portrait"; // Từ khóa tìm kiếm
const MAX_PAGE = 100; // Số trang cần lấy
const PER_PAGE = 24; // Số ảnh mỗi trang
const IMG_FILE = "img.txt"; // File lưu danh sách ảnh
const DOWNLOAD_FOLDER = path.join(__dirname, "images");

// Tạo thư mục images nếu chưa có
if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);

// Đọc danh sách ảnh đã có trong img.txt
let savedUrls = new Set();
if (fs.existsSync(IMG_FILE)) {
  savedUrls = new Set(fs.readFileSync(IMG_FILE, "utf-8").split("\n").filter(Boolean));
}

// Hàm tải ảnh
async function downloadImage(url, page, index) {
  const filePath = path.join(DOWNLOAD_FOLDER, `image_${page}_${index + 1}.jpg`);
  if (fs.existsSync(filePath)) return console.log(`⚠️ Ảnh đã tồn tại: ${filePath}`);

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);
    console.log(`✅ Đã tải ảnh: ${filePath}`);
  } catch (error) {
    console.error(`❌ Lỗi tải ảnh ${url}: `, error.message);
  }
}

// Hàm lấy ảnh từ API
async function fetchPhotos(page) {
  const URL = `https://api.pexels.com/v1/search?query=${encodeURIComponent(QUERY)}&page=${page}&per_page=${PER_PAGE}`;

  try {
    const response = await axios.get(URL, { headers: { Authorization: API_KEY } });
    const newPhotos = response.data.photos.map(photo => photo.src.large).filter(url => !savedUrls.has(url));
    if (newPhotos.length === 0) {
      console.log(`✅ Trang ${page}: Không có ảnh mới để tải.`);
      return;
    }

    // Lưu URL mới vào file img.txt
    fs.appendFileSync(IMG_FILE, newPhotos.join("\n") + "\n");

    // Tải ảnh về
    for (let i = 0; i < newPhotos.length; i++) {
      await downloadImage(newPhotos[i], page, i);
    }

    console.log(`🎉 Trang ${page}: Hoàn tất tải ảnh!`);
  } catch (error) {
    console.error(`❌ Lỗi lấy dữ liệu trang ${page}:`, error.message);
  }
}

(async () => {
  for (let page = 1; page <= MAX_PAGE; page++) {
    await fetchPhotos(page);
  }
})();
