import db, { TaskStatus } from '../db/index.js';
import crypto from 'crypto';
import { join } from 'path';
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