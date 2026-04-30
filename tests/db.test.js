import { describe, it } from 'node:test';
import assert from 'node:assert';
import db, { TaskStatus } from '../src/db/index.js';

describe('Database Module', () => {
    it('should export db object', () => {
        assert.ok(db, 'db should be exported');
        assert.strictEqual(typeof db.prepare, 'function', 'db.prepare should be a function');
    });

    it('should export TaskStatus enum', () => {
        assert.ok(TaskStatus, 'TaskStatus should be exported');
        assert.strictEqual(TaskStatus.PENDING, 'pending');
        assert.strictEqual(TaskStatus.PRINTING, 'printing');
        assert.strictEqual(TaskStatus.SUCCESS, 'success');
        assert.strictEqual(TaskStatus.FAILED, 'failed');
    });

    it('should have tasks table', () => {
        const tables = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'"
        ).all();
        assert.strictEqual(tables.length, 1, 'tasks table should exist');
    });

    it('should create a task with pending status', () => {
        const testInvoiceId = 'test-invoice-' + Date.now();
        const result = db.prepare(`
            INSERT INTO tasks (invoice_id, file_name, file_path, status)
            VALUES (?, ?, ?, ?)
        `).run(testInvoiceId, 'test.pdf', '/path/test.pdf', TaskStatus.PENDING);

        assert.ok(result.lastInsertRowid, 'should return lastInsertRowid');

        const task = db.prepare('SELECT * FROM tasks WHERE invoice_id = ?').get(testInvoiceId);
        assert.strictEqual(task.invoice_id, testInvoiceId);
        assert.strictEqual(task.status, TaskStatus.PENDING);
        assert.strictEqual(task.retry_count, 0);

        db.prepare('DELETE FROM tasks WHERE invoice_id = ?').run(testInvoiceId);
    });

    it('should have indexes on status and invoice_id', () => {
        const indexes = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'"
        ).all();

        const indexNames = indexes.map(i => i.name);
        assert.ok(indexNames.some(n => n.includes('status')), 'should have status index');
        assert.ok(indexNames.some(n => n.includes('invoice_id')), 'should have invoice_id index');
    });
});