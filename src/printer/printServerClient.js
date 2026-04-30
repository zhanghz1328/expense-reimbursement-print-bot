import axios from 'axios';
import config from '../config.js';
import fs from 'fs';
import path from 'path';

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