# Project Structure Guide

This document defines the intended directory responsibilities to keep the codebase readable as it grows.

## Top-Level Layout

```text
.
|-- src/                 # Frontend app (React + TS)
|-- server/              # Backend API (Express)
|-- docs/                # Refactor notes and architecture docs
|-- scripts/             # Repo utility scripts
|-- data/                # Runtime local data (model history)
|-- public/              # Static assets
|-- dist/                # Build output
```

## Frontend (`src/`)

```text
src/
|-- components/
|   |-- audit/           # Audit page-specific UI
|   |-- common/          # Shared generic UI
|   |-- settings/        # Settings modal sub-sections
|-- hooks/
|   |-- audit/           # Audit controller internals (selectors/helpers/orchestrator)
|-- services/
|   |-- vision/          # OCR/VLM parser and prompt logic
|-- config/              # Business rules and app config
|-- domain/              # Domain types/constants (provider, etc.)
|-- App.tsx              # App shell and routing between modes
|-- index.tsx            # Frontend bootstrap
```

### Frontend conventions

- Keep page composition in `components/*Page.tsx`; move non-UI logic to hooks/services.
- Keep provider-independent domain types in `src/domain` (or split by domain subfolders if needed).
- Keep third-party API parsing in `services/vision/*`; keep business checks in `services/auditService.ts`.

## Backend (`server/`)

```text
server/
|-- routes/              # Route registration + request adaptation
|-- services/            # External HTTP integrations
|-- repo/                # Local persistence access
|-- middleware/          # Validation/rate-limit/async wrappers
|-- scripts/             # Runtime helper scripts (e.g. OCR python script)
|-- app.js               # Express app assembly
|-- index.js             # Runtime entry
|-- config.js            # Central runtime config/env parsing
|-- errors.js            # AppError and error helpers
```

### Backend conventions

- `routes`: no business-heavy logic; delegate to `services`/`repo`.
- `config.js`: all env access should be centralized here.
- New feature modules should follow: `routes/<feature>Routes.js` + `services/<feature>Service.js`.

## Current cleanup done

- Moved OCR script from repo root to `server/scripts/ocr_script.py`.
- OCR process config now centralized in `server/config.js` (`OCR_PYTHON_BIN`, `OCR_SCRIPT_PATH`).
- Removed unused frontend file `src/constants.ts`.
