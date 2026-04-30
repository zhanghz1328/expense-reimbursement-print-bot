import { describe, it } from 'node:test';
import assert from 'node:assert';
import { printPDF, getJobStatus } from '../src/printer/printServerClient.js';

describe('Printer Client', () => {
    it('should export printPDF function', () => {
        assert.strictEqual(typeof printPDF, 'function');
    });

    it('should export getJobStatus function', () => {
        assert.strictEqual(typeof getJobStatus, 'function');
    });
});