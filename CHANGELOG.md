# 更新日志

## [Unreleased]

- 暂无

## [1.1.0] - 2026-02-09

### 功能与体验
- 移除 Electron，统一为纯 Web + Vite 运行链路。
- 后端完成模块化拆分（`routes/services/repo/middleware/config`），降低单文件复杂度。
- 前端 `useAuditController` 分层重构，抽离 orchestrator/helpers/selectors。
- 引入 `zod` 进行 AI 输出 schema 校验，提升异常输入容错性。
- 增加测试基线（hooks、parsers、server e2e），当前测试 22/22 通过。
- 新增目录职责文档 `docs/project-structure.md`，并整理 OCR 脚本目录结构。
- 归档模式支持 docx 转图片识别，并叠加文本抽取做双通道补强。
- 新增 README 版本号同步脚本，便于发布前更新说明。

### 修复
- 非标票据不再校验购买方名称与税号，避免误报。
- 清空票据审核列表时同步重置招待费申请单状态，避免旧数据污染。
- 修复日期解析的时区偏移问题，工作日回推更准确。
- 手动差旅起止日期倒置时，自动回退为系统推断范围。

### 稳定性
- `/api` 增加请求校验、统一错误边界与限流中间件。
- OCR 子进程增加并发上限与超时保护。
- 构建增加动态分包（manualChunks）并优化首屏主包体积。
