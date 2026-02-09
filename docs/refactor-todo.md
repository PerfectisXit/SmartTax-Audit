# SmartTax 架构改造 TODO

## P0 - 已开始

- [x] 统一构建链路为 Vite，清理 CRA 遗留脚本与依赖
- [x] 统一开发端口与文档说明（前端 5173，后端 3001）
- [x] 抽离统一 Provider 领域类型，减少跨文件重复定义
- [x] 清理关键流程中的 `provider as any`

## P1 - 下一步（建议本周）

- [x] 拆分 `useAuditController`（第一阶段）：已抽离 credentials/helpers/selectors
- [x] 拆分 `useAuditController`（第二阶段）：提取异步编排为独立 orchestrator hook
- [x] 为 AI 输出解析增加 schema 校验（zod）
- [x] 加入最小测试基线（规则单测 + 解析契约测试）
- [x] 后端 `server.js` 模块化（routes/services/repo）

## P2 - 稳定性与安全

- [x] 为 `/api` 增加请求校验、中间件错误边界、限流
- [x] OCR 子进程增加超时与并发保护
- [x] 业务常量（税号、节假日）配置化与版本化
- [x] 构建产物体积优化（动态分包）

## P3 - 可读性整理

- [x] 输出目录职责文档（`docs/project-structure.md`）
- [x] OCR 脚本归档到 `server/scripts/`，避免根目录脚本漂移
- [x] 清理未使用文件（`src/constants.ts`）
