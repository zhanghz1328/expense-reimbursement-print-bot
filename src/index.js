import { startScheduler } from './scheduler/index.js';
import { startWebServer } from './web/server.js';
import { initApiClient } from './api/client.js';
import config from './config.js';

console.log('========================================');
console.log('  费用报销系统电子单据自动打印');
console.log('========================================');
console.log(`  版本: 1.0.0`);
console.log(`  时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
console.log('========================================');

async function main() {
    try {
        console.log('[主进程] 初始化 API 客户端...');
        await initApiClient();
        console.log('[主进程] API 客户端初始化完成');

        console.log('[主进程] 启动调度器...');
        startScheduler();

        console.log('[主进程] 启动 Web 管理后台...');
        startWebServer();

        console.log('========================================');
        console.log('  系统已就绪！');
        console.log(`  管理后台: http://localhost:${config.web.port}`);
        console.log('  按 Ctrl+C 停止');
        console.log('========================================');

    } catch (error) {
        console.error('[主进程] 启动失败:', error.message);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n[主进程] 收到停止信号，正在关闭...');
    process.exit(0);
});

main();