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
["output", "download", "uploads"].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// 监听 WxVoice 错误
voice.on("error", (err) => {
    console.error("转换错误:", err);
});

/**
 * 处理音频转换
 * @param {string} inputPath - 输入音频文件路径
 * @param {string} outputPath - 输出音频文件路径
 * @param {object} res - Express 响应对象
 */
const convertAudio = (inputPath, outputPath, res) => {
    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: "音频文件不存在" });
    }

    if (fs.existsSync(outputPath)) {
        console.log("文件已转换过，直接返回:", outputPath);
        return res.download(outputPath);
    }

    // 设置超时时间（30 秒）
    const timeout = setTimeout(() => {
        console.error("转换超时:", inputPath);
        res.status(500).json({ error: "音频转换超时" });
    }, 30000);

    voice.decode(inputPath, outputPath, { format: "silk" }, (file) => {
        clearTimeout(timeout);
        console.log("转换完成:", file);
        res.download(file, (err) => {
            if (err) console.error("文件下载错误:", err);
            fs.unlinkSync(inputPath); // 删除上传的原始文件
        });
    });
};

// 语音转换接口（支持文件上传、URL、Base64）
app.post("/convert", upload.single("audio"), async (req, res) => {
    let { audioUrl, base64Audio, fileName } = req.body;

    let inputPath, outputPath;

    try {
        if (req.file) {
            // 处理文件上传
            inputPath = req.file.path;
        } else if (audioUrl) {
            // 处理远程 URL 下载
            fileName = fileName || `download_${Date.now()}`;
            inputPath = `download/${fileName}.mp3`;
            const response = await axios.get(audioUrl, { responseType: "arraybuffer" });
            fs.writeFileSync(inputPath, Buffer.from(response.data));
        } else if (base64Audio) {
            // 处理 Base64 格式
            fileName = fileName || `base64_${Date.now()}`;
            inputPath = `download/${fileName}.mp3`;
            const buffer = Buffer.from(base64Audio, "base64");
            fs.writeFileSync(inputPath, buffer);
        } else {
            return res.status(400).json({ error: "请提供音频文件、URL 或 Base64" });
        }

        if (!fs.existsSync(inputPath)) {
            return res.status(500).json({ error: "音频文件创建失败" });
        }

        // 设置导出的文件名
        outputPath = `output/${Date.now()}.silk`;
        convertAudio(inputPath, outputPath, res);
    } catch (error) {
        console.error("处理音频失败:", error);
        return res.status(500).json({ error: "音频处理失败" });
    }
});

// 启动服务器
app.listen(30000, () => console.log("服务启动: http://localhost:30000"));
