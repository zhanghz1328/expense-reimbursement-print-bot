import { describe, it } from 'node:test';
import assert from 'node:assert';
import { notifyFailure } from '../src/notifier/index.js';

describe('Notifier Module', () => {
    it('should export notifyFailure function', () => {
        assert.strictEqual(typeof notifyFailure, 'function');
    });
});