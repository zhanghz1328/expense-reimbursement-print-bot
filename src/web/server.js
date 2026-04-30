import express from 'express';
import config from '../config.js';
import tasksRouter from './routes/tasks.js';
import statsRouter from './routes/stats.js';
import configRouter from './routes/config.js';

const app = express();
app.use(express.json());

app.use('/tasks', tasksRouter);
app.use('/stats', statsRouter);
app.use('/config', configRouter);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = config.web.port;

export function startWebServer() {
    app.listen(PORT, () => {
        console.log(`[Web服务] 管理后台已启动: http://localhost:${PORT}`);
        console.log(`[Web服务] 任务列表: http://localhost:${PORT}/tasks`);
        console.log(`[Web服务] 统计数据: http://localhost:${PORT}/stats`);
        console.log(`[Web服务] 配置信息: http://localhost:${PORT}/config`);
    });
}

export default app;