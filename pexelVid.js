const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_KEY = "bP9KKZzUS9ZjyjFXHM3Oiq9JkfpjOkkPQd8SmNJtf3z5NS9DxJKEK3Uf";
const QUERY = "japanese"; // Từ khóa tìm kiếm
const MAX_PAGE = 100; // Số trang cần lấy
const PER_PAGE = 24; // Số video mỗi trang
const VIDEO_FILE = "video.txt"; // File lưu danh sách video
const DOWNLOAD_FOLDER = path.join(__dirname, "videos");

// Tạo thư mục videos nếu chưa có
if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER);

// Đọc danh sách video đã có trong video.txt
let savedUrls = new Set();
if (fs.existsSync(VIDEO_FILE)) {
  savedUrls = new Set(fs.readFileSync(VIDEO_FILE, "utf-8").split("\n").filter(Boolean));
}

// Hàm tải video
async function downloadVideo(url, page, index) {
  const filePath = path.join(DOWNLOAD_FOLDER, `video_${page}_${index + 1}.mp4`);
  if (fs.existsSync(filePath)) return console.log(`⚠️ Video đã tồn tại: ${filePath}`);

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);
    console.log(`✅ Đã tải video: ${filePath}`);
  } catch (error) {
    console.error(`❌ Lỗi tải video ${url}: `, error.message);
  }
}

// Hàm lấy video từ API
async function fetchVideos(page) {
  const URL = `https://api.pexels.com/videos/search?query=${encodeURIComponent(QUERY)}&page=${page}&per_page=${PER_PAGE}`;

  try {
    const response = await axios.get(URL, { headers: { Authorization: API_KEY } });
    const newVideos = response.data.videos.map(video => video.video_files[0].link).filter(url => !savedUrls.has(url));
    if (newVideos.length === 0) {
      console.log(`✅ Trang ${page}: Không có video mới để tải.`);
      return;
    }

    // Lưu URL mới vào file video.txt
    fs.appendFileSync(VIDEO_FILE, newVideos.join("\n") + "\n");

    // Tải video về
    for (let i = 0; i < newVideos.length; i++) {
      await downloadVideo(newVideos[i], page, i);
    }

    console.log(`🎉 Trang ${page}: Hoàn tất tải video!`);
  } catch (error) {
    console.error(`❌ Lỗi lấy dữ liệu trang ${page}:`, error.message);
  }
}

(async () => {
  for (let page = 1; page <= MAX_PAGE; page++) {
    await fetchVideos(page);
  }
})();
