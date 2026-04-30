import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fetchInvoices, downloadInvoice } from '../src/api/client.js';

describe('API Client', () => {
    it('should export fetchInvoices function', () => {
        assert.strictEqual(typeof fetchInvoices, 'function');
    });

    it('should export downloadInvoice function', () => {
        assert.strictEqual(typeof downloadInvoice, 'function');
    });
});