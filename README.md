
# SmartTax Audit Expert (智能财务票据审核助手)

SmartTax Audit Expert 是一款基于大语言模型（LLM）和视觉理解（VLM）技术的智能财务报销辅助工具。它能够自动识别、审核发票和差旅凭证，帮助财务人员和员工高效完成报销流程。

## 🌟 核心功能

### 1. 单张票据智能审核
*   **多模态识别**：支持上传 JPG, PNG 图片或 PDF 电子发票。
*   **合规性检查**：
    *   自动比对购买方名称与税号（内置企业白名单）。
    *   检查发票类型（如：住宿费必须为增值税专用发票）。
*   **业务招待单生成**：针对餐饮发票，自动根据金额和日期生成符合公司规定的《业务招待费用申请单》Word 文档。

### 2. 差旅费批量报销 (Travel Reimbursement)
*   **智能归档 (Organizer Mode)**：
    *   批量上传混合的票据文件。
    *   AI 自动分类（发票、非报销单据、出差申请单）。
    *   AI 自动重命名（例如：“机票_北京行程_1200元_2024.01.01.pdf”）。
    *   一键打包下载整理好的文件。
*   **报销计算器 (Calculator Mode)**：
    *   自动提取所有票据金额、日期、税额。
    *   **智能行程分析**：根据票据日期自动推算差旅起止时间。
    *   **费用自动归集**：
        *   城市间交通（飞机/高铁）
        *   市内交通（打车/客运）
        *   住宿费
        *   其他/培训费
    *   **补贴计算**：支持自定义每日出差补贴标准。
    *   **退票检测**：自动识别并剔除包含“退票”、“退款”字样的废票。

## 🛠️ 技术栈

*   **前端**：React 18, TypeScript, Tailwind CSS
*   **构建工具**：Vite / Create React App (Webpack)
*   **AI 服务集成**：
    *   SiliconFlow (硅基流动) - *推荐*
    *   Moonshot AI (Kimi)
    *   MiniMax (海螺)
    *   Zhipu AI (智谱 GLM-4V)
    *   Aliyun DashScope (通义千问 VL)
*   **文档处理**：PDF.js (预览), Mammoth (Word提取), jsPDF (图片转PDF), docx (生成文档)

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
# 或者
yarn install
```

### 2. 启动开发服务器

```bash
npm start
# 或者
yarn start
```

应用将在 `http://localhost:3000` (或 3001) 启动。

## ⚙️ 配置指南

首次使用时，请点击右上角的 **“设置”** 按钮配置 AI 服务：

1.  **选择服务商**：推荐使用 **SiliconFlow** 或 **Kimi**，它们在中文票据识别方面表现优异。
2.  **输入模型名称**：
    *   SiliconFlow: `Pro/Qwen/Qwen2-VL-7B-Instruct` (性价比高) 或 `Pro/moonshotai/Kimi-k2.5`
    *   Kimi: `moonshot-v1-8k`
    *   Zhipu: `glm-4v`
3.  **填写 API Key**：前往对应服务商的开发者平台获取 Key。

## 📝 注意事项

*   **数据安全**：本项目纯前端运行（除可选的本地 Python OCR 服务外），图片直接发送至您配置的 LLM 服务商，不会存储在任何中间服务器。
*   **PDF 处理**：项目内置了 PDF.js 用于在浏览器端渲染 PDF 预览，无需后端转换。
*   **并发限制**：为避免触发 API 速率限制（Rate Limit），批量处理时采用了并发控制队列（默认并发数：3）。

## 📄 License

MIT
# 发布说明

推荐使用 `release.sh` 一键发布：

```bash
./release.sh patch   # 1.0.0 -> 1.0.1
./release.sh minor   # 1.0.0 -> 1.1.0
./release.sh major   # 1.0.0 -> 2.0.0
```

脚本会自动：
1. 检查是否有未提交改动
2. 更新 `package.json` 版本号
3. 推送代码与 tag

然后在 GitHub 仓库的 Releases 页面创建 Release（选择对应 tag 即可）。
