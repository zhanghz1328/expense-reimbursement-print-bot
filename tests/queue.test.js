import { describe, it } from 'node:test';
import assert from 'node:assert';
import { addToQueue, getPendingTasks, getStats } from '../src/queue/index.js';

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