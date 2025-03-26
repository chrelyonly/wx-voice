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

// 确保 output 目录存在
if (!fs.existsSync("output")) {
    fs.mkdirSync("output");
}

// 监听 WxVoice 错误
voice.on("error", (err)=>{
  console.error("转换错误:", err)
});

/**
 * 处理音频转换
 * @param {string} inputPath - 输入音频文件路径
 * @param {string} outputPath - 输出 音频文件路径
 * @param {object} res - Express 响应对象
 */
const convertAudio = (inputPath, outputPath, res) => {
    if (fs.existsSync(outputPath)) {
        console.log("文件已转换过，直接返回:", outputPath);
        return res.download(outputPath);
    }

    voice.decode(inputPath, outputPath, { format: "silk" }, () => {
        console.log("转换完成:", outputPath);
        res.download(outputPath, (err) => {
            if (err) console.error("文件下载错误:", err);
            fs.unlinkSync(inputPath); // 删除上传的原始文件
        });
    });
};

// 语音转换接口（支持文件上传、URL、Base64）
app.post("/convert", upload.single("audio"), async (req, res) => {
    let { audioUrl, base64Audio, fileName } = req.body;

    let inputPath, outputPath;

    // 如果是表单提交
    if (req.file) {
        // 处理文件上传
        inputPath = req.file.path;
        fileName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    } else if (audioUrl) {
        // 如果是提交了个url地址,那么则进行远程下载到本地
        fileName = fileName || `download_${Date.now()}`;
        inputPath = `download/${fileName}.mp3`;
        try {
            const response = await axios.get(audioUrl, { responseType: "arraybuffer" });
            fs.writeFileSync(inputPath, Buffer.from(response.data));
        } catch (error) {
            console.error("下载音频失败:", error);
            return res.status(400).json({ error: "无法下载音频文件" });
        }
    } else if (base64Audio) {
        // 如果是以base64格式传入的处理 Base64 音频        完整的base64音频data:audio/mpeg;base64,
        fileName = fileName || `base64_${Date.now()}`;
        inputPath = `download/${fileName}.mp3`;
        try {
            const buffer = Buffer.from(base64Audio, "base64");
            fs.writeFileSync(inputPath, buffer);
        } catch (error) {
            console.error("Base64 解析失败:", error);
            return res.status(400).json({ error: "无效的 Base64 音频" });
        }
    } else {
        return res.status(400).json({ error: "请提供音频文件、URL 或 Base64" });
    }
    // 设置导出的文件名
    outputPath = `output/${Date.now()}.silk`;
    convertAudio(inputPath, outputPath, res);
});

// 启动服务器
app.listen(30000, () => console.log("服务启动: http://localhost:30000"));
