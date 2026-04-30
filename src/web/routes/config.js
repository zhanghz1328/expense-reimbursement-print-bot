import { Router } from 'express';
import config from '../../config.js';

const router = Router();

router.get('/', (req, res) => {
    const safeConfig = {
        api: {
            baseUrl: config.api.baseUrl,
            fetchSchedules: config.api.fetchSchedules
        },
        printServer: {
            url: config.printServer.url,
            queueName: config.printServer.queueName
        },
        notification: {
            email: {
                host: config.notification.email.host,
                port: config.notification.email.port,
                user: config.notification.email.user,
                to: config.notification.email.to
            },
            teams: {
                webhookUrl: config.notification.teams.webhookUrl ? '(已配置)' : '(未配置)'
            }
        },
        database: {
            path: config.database.path
        },
        web: {
            port: config.web.port
        },
        cache: {
            dir: config.cache.dir
        }
    };

    res.json({ success: true, data: safeConfig });
});

export default router;