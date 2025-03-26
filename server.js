const express = require("express");
const multer = require("multer");
const WxVoice = require("wx-voice");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const voice = new WxVoice();
const upload = multer({ dest: "uploads/" });

app.use(express.json({ limit: "50mb" })); // 解析 JSON，支持 Base64
app.use(express.static("public")); // 提供前端页面

// 确保目录存在
const ensureDirExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📂 目录创建成功: ${dir}`);
    }
};

ensureDirExists("uploads");
ensureDirExists("output");

// 监听 WxVoice 错误
voice.on("error", (err) => console.error("❌ 转换错误:", err));

/**
 * 处理音频转换
 * @param {string} inputPath - 输入音频文件路径
 * @param {string} outputPath - 输出 MP3 文件路径
 * @param {object} res - Express 响应对象
 */
const convertAudio = (inputPath, outputPath, res) => {
    console.log(`🎵 开始转换: ${inputPath} -> ${outputPath}`);
    const startTime = Date.now(); // 记录开始时间

    if (fs.existsSync(outputPath)) {
        console.log(`✅ 文件已存在，直接返回: ${outputPath}`);
        return res.download(outputPath);
    }

    voice.encode(inputPath, outputPath, { format: "silk" }, () => {
        const endTime = Date.now(); // 记录结束时间
        const duration = ((endTime - startTime) / 1000).toFixed(2); // 计算转换耗时（秒）

        console.log(`🎉 转换完成: ${outputPath} (耗时 ${duration} 秒)`);
        res.download(outputPath, `${Date.now()}.silk`, (err) => {
            if (err) {
                console.error("⚠️ 文件下载错误:", err);
            } else {
                console.log(`⬇️ 文件下载成功: ${outputPath}`);
            }
            fs.unlinkSync(inputPath); // 删除上传的原始文件
            console.log(`🗑️ 已删除原始文件: ${inputPath}`);
            fs.unlinkSync(outputPath); // 删除上传的原始文件
            console.log(`🗑️ 已删除原始文件: ${outputPath}`);
        });
    });
};

// 语音转换接口（支持文件上传、URL、Base64）
app.post("/convert", upload.single("audio"), async (req, res) => {
    console.log("📥 收到转换请求");

    let { audioUrl, base64Audio, fileName } = req.body;
    let inputPath, outputPath;

    if (req.file) {
        // 处理文件上传
        inputPath = req.file.path;
        fileName = path.basename(req.file.originalname, path.extname(req.file.originalname));
        console.log(`📂 上传文件: ${req.file.originalname}, 存储路径: ${inputPath}`);
    } else if (audioUrl) {
        // 处理远程 URL 下载
        fileName = fileName || `download_${Date.now()}`;
        inputPath = `uploads/${fileName}.mp3`;
        console.log(`🌍 远程下载音频: ${audioUrl}`);

        try {
            const response = await axios.get(audioUrl, { responseType: "arraybuffer" });
            fs.writeFileSync(inputPath, Buffer.from(response.data));
            console.log(`✅ 下载成功，存储路径: ${inputPath}`);
        } catch (error) {
            console.error("❌ 下载音频失败:", error);
            return res.status(400).json({ error: "无法下载音频文件" });
        }
    } else if (base64Audio) {
        // 处理 Base64 音频
        fileName = fileName || `base64_${Date.now()}`;
        inputPath = `uploads/${fileName}.mp3`;

        console.log("🖥️ 解析 Base64 音频");
        try {
            const buffer = Buffer.from(base64Audio, "base64");
            fs.writeFileSync(inputPath, buffer);
            console.log(`✅ Base64 解析成功，存储路径: ${inputPath}`);
        } catch (error) {
            console.error("❌ Base64 解析失败:", error);
            return res.status(400).json({ error: "无效的 Base64 音频" });
        }
    } else {
        console.error("⚠️ 无效的请求: 缺少音频文件、URL 或 Base64");
        return res.status(400).json({ error: "请提供音频文件、URL 或 Base64" });
    }

    outputPath = `output/${fileName}.silk`;
    convertAudio(inputPath, outputPath, res);
});

// 启动服务器
const PORT = 30000;
app.listen(PORT, () => console.log(`🚀 服务器启动: http://localhost:${PORT}`));
