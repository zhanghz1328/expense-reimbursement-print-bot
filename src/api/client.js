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