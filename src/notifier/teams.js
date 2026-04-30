import axios from 'axios';
import config from '../config.js';

export async function sendTeamsNotification(task) {
    const adaptiveCard = {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                type: 'AdaptiveCard',
                version: '1.4',
                body: [{
                    type: 'TextBlock',
                    size: 'Large',
                    weight: 'Bolder',
                    text: '⚠️ 电子票据打印失败'
                }, {
                    type: 'FactSet',
                    facts: [
                        { title: '票据名称', value: task.file_name },
                        { title: '票据ID', value: task.invoice_id },
                        { title: '失败原因', value: task.error_msg || '未知错误' },
                        { title: '重试次数', value: String(task.retry_count) }
                    ]
                }, {
                    type: 'ActionSet',
                    actions: [{
                        type: 'Action.OpenUrl',
                        title: '处理任务',
                        url: 'http://localhost:3000/tasks/' + task.id
                    }]
                }]
            }
        }]
    };

    try {
        await axios.post(config.notification.teams.webhookUrl, adaptiveCard);
        return { success: true, message: 'Teams notification sent' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export default { sendTeamsNotification };