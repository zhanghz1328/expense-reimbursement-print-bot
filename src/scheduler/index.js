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