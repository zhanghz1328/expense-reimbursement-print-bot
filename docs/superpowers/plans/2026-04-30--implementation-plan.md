# 费用报销系统电子单据自动打印 - 实施计划

**Goal:** 实现电子发票（PDF）自动打印，支持定时批量打印、手动补打、异常通知、后台管理

**Architecture:**
- Node.js 应用，定时从报销系统 API 拉取电子票据
- 打印任务通过 Windows Print Server 执行
- 状态持久化到 SQLite，异常通过 QQ邮箱 + Teams 通知
- Web 管理后台提供 Dashboard、任务管理、配置功能

**Tech Stack:** Node.js 20+, better-sqlite3, axios, node-cron, nodemailer, Express

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | Create | 项目依赖 |
| `config.yaml` | Create | 配置文件 |
| `src/db/index.js` | Create | SQLite 数据库初始化 |
| `src/db/migrations/001_create_tasks.sql` | Create | 任务表建表SQL |
| `src/api/client.js` | Create | 报销系统 API 客户端 |
| `src/queue/index.js` | Create | 打印任务队列 |
| `src/scheduler/invoiceFetcher.js` | Create | 票据定时拉取器 |
| `src/scheduler/index.js` | Create | 调度器入口 |
| `src/printer/printServerClient.js` | Create | Print Server API 客户端 |
| `src/notifier/email.js` | Create | QQ邮箱通知 |
| `src/notifier/teams.js` | Create | Teams 通知 |
| `src/notifier/index.js` | Create | 通知服务入口 |
| `src/web/routes/tasks.js` | Create | 任务管理路由 |
| `src/web/routes/stats.js` | Create | 统计路由 |
| `src/web/routes/config.js` | Create | 配置路由 |
| `src/web/server.js` | Create | Web 服务入口 |
| `src/index.js` | Create | 主入口 |
| `tests/db.test.js` | Create | 数据库测试 |
| `tests/api.test.js` | Create | API 客户端测试 |
| `tests/queue.test.js` | Create | 队列测试 |
| `tests/printer.test.js` | Create | 打印客户端测试 |
| `tests/notifier.test.js` | Create | 通知服务测试 |

---

## 任务清单

### Task 1: 项目初始化（package.json + config.yaml）

**涉及文件：**
- Create: `package.json`
- Create: `config.yaml`

#### 步骤分解

- [ ] **Step 1: 创建 package.json**
```json
{
  "name": "expense-reimbursement-print-bot",
  "version": "1.0.0",
  "description": "费用报销系统电子单据自动打印",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --test tests/*.test.js",
    "migrate": "node src/db/migrate.js"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "better-sqlite3": "^11.0.0",
    "express": "^4.19.0",
    "js-yaml": "^4.1.0",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: 创建 config.yaml**
```yaml
# 报销系统 API 配置
api:
  baseUrl: "https://expense-api.company.com"
  username: "your-username"
  password: "your-password"
  fetchSchedules:
    - "0 8 * * *"   # 每天 8:00
    - "0 12 * * *"  # 每天 12:00
    - "0 18 * * *"  # 每天 18:00

# 打印服务配置
printServer:
  url: "http://print-server.company.com:631"
  queueName: "HP-LaserJet-Professional"
  timeout: 60000  # 60秒

# 通知配置
notification:
  email:
    host: "smtp.qq.com"
    port: 587
    user: "your-email@qq.com"
    pass: "your-auth-code"
    to: "zhang.hz@comlan.com"
  teams:
    webhookUrl: "https://outlook.office.com/webhook/your-webhook-url"

# 数据库配置
database:
  path: "./data/tasks.db"

# Web 服务配置
web:
  port: 3000

# 文件缓存
cache:
  dir: "./cache"
```

- [ ] **Step 3: 安装依赖**
```bash
npm install
```

- [ ] **Step 4: 提交代码**
```bash
git add package.json config.yaml
git commit -m "chore: 项目初始化（package.json + config.yaml）"
```

---

### Task 2: 数据库初始化（SQLite + 任务表）

**涉及文件：**
- Create: `src/db/index.js`
- Create: `src/db/migrations/001_create_tasks.sql`
- Create: `src/db/migrate.js`

#### 步骤分解

- [ ] **Step 1: 创建建表 SQL**
```sql
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    fetched_at DATETIME,
    printed_at DATETIME,
    error_msg TEXT,
    retry_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_invoice_id ON tasks(invoice_id);
```

- [ ] **Step 2: 创建 src/db/index.js**
```javascript
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/tasks.db');
const dataDir = dirname(dbPath);

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export default db;

export const TaskStatus = {
    PENDING: 'pending',
    PRINTING: 'printing',
    SUCCESS: 'success',
    FAILED: 'failed'
};
```

- [ ] **Step 3: 创建 src/db/migrate.js**
```javascript
import db from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationPath = join(__dirname, 'migrations/001_create_tasks.sql');
const sql = readFileSync(migrationPath, 'utf-8');

db.exec(sql);
console.log('Migration completed successfully');
```

- [ ] **Step 4: 运行迁移**
```bash
npm run migrate
```

- [ ] **Step 5: 提交代码**
```bash
git add src/db/ tests/db.test.js
git commit -m "feat: 添加数据库初始化模块（SQLite + tasks 表）"
```

---

### Task 3: 报销系统 API 客户端

**涉及文件：**
- Create: `src/api/client.js`

#### 步骤分解

- [ ] **Step 1: 创建 src/api/client.js**
```javascript
import axios from 'axios';
import config from '../config.js';

let apiClient = null;

export async function initApiClient() {
    apiClient = axios.create({
        baseURL: config.api.baseUrl,
        timeout: 30000,
        auth: {
            username: config.api.username,
            password: config.api.password
        }
    });
    return apiClient;
}

export async function fetchInvoices() {
    if (!apiClient) {
        await initApiClient();
    }

    const response = await apiClient.get('/api/invoices/pending', {
        params: {
            site: 'beijing',
            type: 'electronic',
            status: 'approved'
        }
    });

    return response.data.invoices || [];
}

export async function downloadInvoice(invoiceId, savePath) {
    if (!apiClient) {
        await initApiClient();
    }

    const response = await apiClient.get(`/api/invoices/${invoiceId}/pdf`, {
        responseType: 'arraybuffer'
    });

    const fs = await import('fs');
    fs.writeFileSync(savePath, Buffer.from(response.data));
    return savePath;
}

export default {
    initApiClient,
    fetchInvoices,
    downloadInvoice
};
```

- [ ] **Step 2: 创建测试文件 tests/api.test.js**
```javascript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

describe('API Client', () => {
    it('should export fetchInvoices function', () => {
        assert.strictEqual(typeof fetchInvoices, 'function');
    });

    it('should export downloadInvoice function', () => {
        assert.strictEqual(typeof downloadInvoice, 'function');
    });
});
```

- [ ] **Step 3: 运行测试**
```bash
npm test -- tests/api.test.js
```

- [ ] **Step 4: 提交代码**
```bash
git add src/api/client.js tests/api.test.js
git commit -m "feat: 添加报销系统 API 客户端"
```

---

### Task 4: 打印任务队列

**涉及文件：**
- Create: `src/queue/index.js`

#### 步骤分解

- [ ] **Step 1: 创建 src/queue/index.js**
```javascript
import db, { TaskStatus } from '../db/index.js';
import crypto from 'crypto';
import { join, dirname } from 'path';
import config from '../config.js';
import fs from 'fs';

export async function addToQueue(invoiceId, fileName, fileBuffer) {
    const cacheDir = config.cache.dir;
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const filePath = join(cacheDir, `${invoiceId}_${fileHash}.pdf`);

    const existingTask = db.prepare(
        'SELECT id FROM tasks WHERE invoice_id = ?'
    ).get(invoiceId);

    if (existingTask) {
        return { success: false, reason: 'duplicate', taskId: existingTask.id };
    }

    fs.writeFileSync(filePath, fileBuffer);

    const result = db.prepare(`
        INSERT INTO tasks (invoice_id, file_name, file_path, status, fetched_at)
        VALUES (?, ?, ?, ?, datetime('now'))
    `).run(invoiceId, fileName, filePath, TaskStatus.PENDING);

    return { success: true, taskId: result.lastInsertRowid };
}

export function getPendingTasks() {
    return db.prepare(`
        SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC
    `).all();
}

export function updateTaskStatus(taskId, status, errorMsg = null) {
    const updateFields = ['status = ?'];
    const params = [status];

    if (status === TaskStatus.SUCCESS) {
        updateFields.push("printed_at = datetime('now')");
    }
    if (errorMsg) {
        updateFields.push('error_msg = ?');
        params.push(errorMsg);
    }

    params.push(taskId);

    return db.prepare(`
        UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?
    `).run(...params);
}

export function incrementRetry(taskId) {
    return db.prepare(`
        UPDATE tasks SET retry_count = retry_count + 1 WHERE id = ?
    `).run(taskId);
}

export function getTaskById(taskId) {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

export function getAllTasks(limit = 100) {
    return db.prepare(`
        SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?
    `).all(limit);
}

export function getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const success = db.prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE status = 'success'"
    ).get().count;
    const failed = db.prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE status = 'failed'"
    ).get().count;
    const pending = db.prepare(
        "SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'"
    ).get().count;

    return { total, success, failed, pending };
}

export default {
    addToQueue,
    getPendingTasks,
    updateTaskStatus,
    incrementRetry,
    getTaskById,
    getAllTasks,
    getStats
};
```

- [ ] **Step 2: 创建测试文件 tests/queue.test.js**
```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Queue Module', () => {
    it('should export addToQueue function', () => {
        assert.strictEqual(typeof addToQueue, 'function');
    });

    it('should export getPendingTasks function', () => {
        assert.strictEqual(typeof getPendingTasks, 'function');
    });

    it('should export getStats function', () => {
        assert.strictEqual(typeof getStats, 'function');
    });
});
```

- [ ] **Step 3: 运行测试**
```bash
npm test -- tests/queue.test.js
```

- [ ] **Step 4: 提交代码**
```bash
git add src/queue/index.js tests/queue.test.js
git commit -m "feat: 添加打印任务队列模块"
```

---

### Task 5: 打印执行器（Print Server 客户端）

**涉及文件：**
- Create: `src/printer/printServerClient.js`

#### 步骤分解

- [ ] **Step 1: 创建 src/printer/printServerClient.js**
```javascript
import axios from 'axios';
import config from '../config.js';
import fs from 'fs';

const client = axios.create({
    baseURL: config.printServer.url,
    timeout: config.printServer.timeout,
    headers: {
        'Content-Type': 'application/pdf'
    }
});

export async function printPDF(filePath, options = {}) {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = options.fileName || path.basename(filePath);

    try {
        const response = await client.post('/printers/' + config.printServer.queueName + '/jobs', fileBuffer, {
            params: {
                filename: fileName
            }
        });

        return {
            success: true,
            jobId: response.data.jobId,
            message: 'Print job submitted successfully'
        };
    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        return {
            success: false,
            jobId: null,
            message: errorMsg
        };
    }
}

export async function getJobStatus(jobId) {
    try {
        const response = await client.get('/printers/' + config.printServer.queueName + '/jobs/' + jobId);
        return {
            success: true,
            status: response.data.status,
            message: 'Job status retrieved'
        };
    } catch (error) {
        return {
            success: false,
            status: 'unknown',
            message: error.message
        };
    }
}

export default {
    printPDF,
    getJobStatus
};
```

- [ ] **Step 2: 创建测试文件 tests/printer.test.js**
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Printer Client', () => {
    it('should export printPDF function', () => {
        assert.strictEqual(typeof printPDF, 'function');
    });

    it('should export getJobStatus function', () => {
        assert.strictEqual(typeof getJobStatus, 'function');
    });
});
```

- [ ] **Step 3: 运行测试**
```bash
npm test -- tests/printer.test.js
```

- [ ] **Step 4: 提交代码**
```bash
git add src/printer/printServerClient.js tests/printer.test.js
git commit -m "feat: 添加 Print Server 客户端"
```

---

### Task 6: 通知服务（QQ邮箱 + Teams）

**涉及文件：**
- Create: `src/notifier/email.js`
- Create: `src/notifier/teams.js`
- Create: `src/notifier/index.js`

#### 步骤分解

- [ ] **Step 1: 创建 src/notifier/email.js**
```javascript
import nodemailer from 'nodemailer';
import config from '../config.js';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.notification.email.host,
            port: config.notification.email.port,
            secure: false,
            auth: {
                user: config.notification.email.user,
                pass: config.notification.email.pass
            }
        });
    }
    return transporter;
}

export async function sendFailureNotification(task) {
    const transporter = getTransporter();

    const mailOptions = {
        from: config.notification.email.user,
        to: config.notification.email.to,
        subject: `【打印失败】${task.file_name}`,
        text: `
电子票据打印失败

票据名称：${task.file_name}
票据ID：${task.invoice_id}
失败原因：${task.error_msg}
重试次数：${task.retry_count}

请登录管理后台处理：http://localhost:3000
        `.trim()
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export default { sendFailureNotification };
```

- [ ] **Step 2: 创建 src/notifier/teams.js**
```javascript
import axios from 'axios';
import config from '../config.js';

export async function sendTeamsNotification(task) {
    const adaptiveCard = {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                type: 'AdaptiveCard',
                version: '1.4',
                body: [{
                    type: 'TextBlock',
                    size: 'Large',
                    weight: 'Bolder',
                    text: '⚠️ 电子票据打印失败'
                }, {
                    type: 'FactSet',
                    facts: [
                        { title: '票据名称', value: task.file_name },
                        { title: '票据ID', value: task.invoice_id },
                        { title: '失败原因', value: task.error_msg || '未知错误' },
                        { title: '重试次数', value: String(task.retry_count) }
                    ]
                }, {
                    type: 'ActionSet',
                    actions: [{
                        type: 'Action.OpenUrl',
                        title: '处理任务',
                        url: 'http://localhost:3000/tasks/' + task.id
                    }]
                }]
            }
        }]
    };

    try {
        await axios.post(config.notification.teams.webhookUrl, adaptiveCard);
        return { success: true, message: 'Teams notification sent' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export default { sendTeamsNotification };
```

- [ ] **Step 3: 创建 src/notifier/index.js**
```javascript
import { sendFailureNotification as sendEmail } from './email.js';
import { sendTeamsNotification as sendTeams } from './teams.js';

export async function notifyFailure(task) {
    const results = await Promise.allSettled([
        sendEmail(task),
        sendTeams(task)
    ]);

    return {
        email: results[0].status === 'fulfilled' ? results[0].value : results[0].reason,
        teams: results[1].status === 'fulfilled' ? results[1].value : results[1].reason
    };
}

export default { notifyFailure };
```

- [ ] **Step 4: 创建测试文件 tests/notifier.test.js**
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Notifier Module', () => {
    it('should export notifyFailure function', () => {
        assert.strictEqual(typeof notifyFailure, 'function');
    });
});
```

- [ ] **Step 5: 运行测试**
```bash
npm test -- tests/notifier.test.js
```

- [ ] **Step 6: 提交代码**
```bash
git add src/notifier/ tests/notifier.test.js
git commit -m "feat: 添加通知服务（QQ邮箱 + Teams）"
```

---

### Task 7: 调度器（票据拉取 + 打印调度）

**涉及文件：**
- Create: `src/scheduler/invoiceFetcher.js`
- Create: `src/scheduler/index.js`

#### 步骤分解

- [ ] **Step 1: 创建 src/scheduler/invoiceFetcher.js**
```javascript
import { fetchInvoices, downloadInvoice } from '../api/client.js';
import { addToQueue } from '../queue/index.js';
import config from '../config.js';
import { join } from 'path';
import fs from 'fs';

export async function fetchAndQueueInvoices() {
    console.log('[票据拉取器] 开始拉取票据...');

    try {
        const invoices = await fetchInvoices();
        console.log(`[票据拉取器] 拉到 ${invoices.length} 条票据`);

        const results = {
            success: 0,
            duplicate: 0,
            failed: 0
        };

        for (const invoice of invoices) {
            const cacheDir = config.cache.dir;
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            const filePath = join(cacheDir, `${invoice.id}.pdf`);
            await downloadInvoice(invoice.id, filePath);

            const fileBuffer = fs.readFileSync(filePath);
            const result = await addToQueue(invoice.id, invoice.fileName, fileBuffer);

            if (result.success) {
                results.success++;
            } else if (result.reason === 'duplicate') {
                results.duplicate++;
            } else {
                results.failed++;
            }
        }

        console.log(`[票据拉取器] 完成：新增${results.success}，重复${results.duplicate}，失败${results.failed}`);
        return results;

    } catch (error) {
        console.error('[票据拉取器] 拉取失败:', error.message);
        throw error;
    }
}

export default { fetchAndQueueInvoices };
```

- [ ] **Step 2: 创建 src/scheduler/index.js**
```javascript
import cron from 'node-cron';
import { fetchAndQueueInvoices } from './invoiceFetcher.js';
import { getPendingTasks, updateTaskStatus, incrementRetry, getTaskById } from '../queue/index.js';
import { printPDF } from '../printer/printServerClient.js';
import { notifyFailure } from '../notifier/index.js';
import config from '../config.js';

const MAX_RETRY = 3;

export function startScheduler() {
    console.log('[调度器] 启动调度器...');

    for (const schedule of config.api.fetchSchedules) {
        cron.schedule(schedule, async () => {
            try {
                await fetchAndQueueInvoices();
            } catch (error) {
                console.error('[调度器] 票据拉取出错:', error.message);
            }
        });
        console.log(`[调度器] 票据拉取任务已注册: ${schedule}`);
    }

    cron.schedule('0 * * * *', async () => {
        await processPrintQueue();
    });
    console.log('[调度器] 打印队列处理任务已注册: 每小时整点执行');
}

export async function processPrintQueue() {
    console.log('[调度器] 开始处理打印队列...');

    const pendingTasks = getPendingTasks();
    console.log(`[调度器] 待处理任务: ${pendingTasks.length}`);

    for (const task of pendingTasks) {
        const taskDetail = getTaskById(task.id);
        if (!taskDetail) continue;

        updateTaskStatus(task.id, 'printing');

        const printResult = await printPDF(taskDetail.file_path, {
            fileName: taskDetail.file_name
        });

        if (printResult.success) {
            updateTaskStatus(task.id, 'success');
            console.log(`[调度器] 打印成功: ${taskDetail.file_name}`);
        } else {
            incrementRetry(task.id);

            if (taskDetail.retry_count + 1 >= MAX_RETRY) {
                updateTaskStatus(task.id, 'failed', printResult.message);
                console.error(`[调度器] 打印失败（已达最大重试）: ${taskDetail.file_name}`);

                const updatedTask = getTaskById(task.id);
                await notifyFailure(updatedTask);
            } else {
                updateTaskStatus(task.id, 'pending');
                console.warn(`[调度器] 打印失败（将重试）: ${taskDetail.file_name}`);
            }
        }
    }

    console.log('[调度器] 打印队列处理完成');
}

export default { startScheduler, processPrintQueue };
```

- [ ] **Step 3: 提交代码**
```bash
git add src/scheduler/
git commit -m "feat: 添加调度器（票据拉取 + 打印队列处理）"
```

---

### Task 8: Web 管理后台

**涉及文件：**
- Create: `src/web/routes/tasks.js`
- Create: `src/web/routes/stats.js`
- Create: `src/web/routes/config.js`
- Create: `src/web/server.js`

#### 步骤分解

- [ ] **Step 1: 创建 src/web/routes/tasks.js**
```javascript
import { Router } from 'express';
import { getAllTasks, getTaskById, updateTaskStatus, getPendingTasks } from '../../queue/index.js';
import { printPDF } from '../../printer/printServerClient.js';
import { notifyFailure } from '../../notifier/index.js';

const router = Router();

router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const tasks = getAllTasks(limit);
    res.json({ success: true, data: tasks });
});

router.get('/:id', (req, res) => {
    const task = getTaskById(req.params.id);
    if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, data: task });
});

router.post('/:id/retry', async (req, res) => {
    const task = getTaskById(req.params.id);
    if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
    }

    updateTaskStatus(task.id, 'printing');

    const printResult = await printPDF(task.file_path, {
        fileName: task.file_name
    });

    if (printResult.success) {
        updateTaskStatus(task.id, 'success');
        res.json({ success: true, message: 'Print job submitted successfully' });
    } else {
        updateTaskStatus(task.id, 'failed', printResult.message);
        const updatedTask = getTaskById(task.id);
        await notifyFailure(updatedTask);
        res.json({ success: false, message: printResult.message });
    }
});

router.post('/:id/cancel', (req, res) => {
    const task = getTaskById(req.params.id);
    if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
    }

    updateTaskStatus(task.id, 'failed', 'Cancelled by user');
    res.json({ success: true, message: 'Task cancelled' });
});

export default router;
```

- [ ] **Step 2: 创建 src/web/routes/stats.js**
```javascript
import { Router } from 'express';
import { getStats } from '../../queue/index.js';

const router = Router();

router.get('/', (req, res) => {
    const stats = getStats();
    res.json({ success: true, data: stats });
});

export default router;
```

- [ ] **Step 3: 创建 src/web/routes/config.js**
```javascript
import { Router } from 'express';
import config from '../../config.js';

const router = Router();

router.get('/', (req, res) => {
    const safeConfig = {
        api: {
            baseUrl: config.api.baseUrl,
            fetchSchedules: config.api.fetchSchedules
        },
        printServer: {
            url: config.printServer.url,
            queueName: config.printServer.queueName
        },
        notification: {
            email: {
                host: config.notification.email.host,
                port: config.notification.email.port,
                user: config.notification.email.user,
                to: config.notification.email.to
            },
            teams: {
                webhookUrl: config.notification.teams.webhookUrl ? '(已配置)' : '(未配置)'
            }
        },
        database: {
            path: config.database.path
        },
        web: {
            port: config.web.port
        },
        cache: {
            dir: config.cache.dir
        }
    };

    res.json({ success: true, data: safeConfig });
});

export default router;
```

- [ ] **Step 4: 创建 src/web/server.js**
```javascript
import express from 'express';
import config from '../config.js';
import tasksRouter from './routes/tasks.js';
import statsRouter from './routes/stats.js';
import configRouter from './routes/config.js';

const app = express();
app.use(express.json());

app.use('/tasks', tasksRouter);
app.use('/stats', statsRouter);
app.use('/config', configRouter);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = config.web.port;

export function startWebServer() {
    app.listen(PORT, () => {
        console.log(`[Web服务] 管理后台已启动: http://localhost:${PORT}`);
        console.log(`[Web服务] 任务列表: http://localhost:${PORT}/tasks`);
        console.log(`[Web服务] 统计数据: http://localhost:${PORT}/stats`);
        console.log(`[Web服务] 配置信息: http://localhost:${PORT}/config`);
    });
}

export default app;
```

- [ ] **Step 5: 提交代码**
```bash
git add src/web/
git commit -m "feat: 添加 Web 管理后台（Dashboard + 任务管理 + 配置）"
```

---

### Task 9: 主入口整合

**涉及文件：**
- Create: `src/index.js`
- Create: `src/config.js`

#### 步骤分解

- [ ] **Step 1: 创建 src/config.js**
```javascript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../config.yaml');
const configContent = fs.readFileSync(configPath, 'utf-8');
const config = yaml.load(configContent);

export default config;
```

- [ ] **Step 2: 创建 src/index.js**
```javascript
import { startScheduler } from './scheduler/index.js';
import { startWebServer } from './web/server.js';
import { initApiClient } from './api/client.js';
import config from './config.js';

console.log('========================================');
console.log('  费用报销系统电子单据自动打印');
console.log('========================================');
console.log(`  版本: 1.0.0`);
console.log(`  时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
console.log('========================================');

async function main() {
    try {
        console.log('[主进程] 初始化 API 客户端...');
        await initApiClient();
        console.log('[主进程] API 客户端初始化完成');

        console.log('[主进程] 启动调度器...');
        startScheduler();

        console.log('[主进程] 启动 Web 管理后台...');
        startWebServer();

        console.log('========================================');
        console.log('  系统已就绪！');
        console.log(`  管理后台: http://localhost:${config.web.port}`);
        console.log('  按 Ctrl+C 停止');
        console.log('========================================');

    } catch (error) {
        console.error('[主进程] 启动失败:', error.message);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n[主进程] 收到停止信号，正在关闭...');
    process.exit(0);
});

main();
```

- [ ] **Step 3: 提交代码**
```bash
git add src/index.js src/config.js
git commit -m "feat: 添加主入口（整合调度器 + Web 服务）"
```

---

## 交付物检查

- [ ] Task 1: 项目初始化（package.json + config.yaml）
- [ ] Task 2: 数据库初始化（SQLite + 任务表）
- [ ] Task 3: 报销系统 API 客户端
- [ ] Task 4: 打印任务队列
- [ ] Task 5: 打印执行器（Print Server 客户端）
- [ ] Task 6: 通知服务（QQ邮箱 + Teams）
- [ ] Task 7: 调度器（票据拉取 + 打印调度）
- [ ] Task 8: Web 管理后台
- [ ] Task 9: 主入口整合

---

## 后续步骤

1. 切换到 `dev` 分支执行开发
2. 按 Task 顺序执行，每个 Task 独立提交
3. 使用 git-worktrees 并行开发（可选）
4. 完成后提交 PR 进行代码审查