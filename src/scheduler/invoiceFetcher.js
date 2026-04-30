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