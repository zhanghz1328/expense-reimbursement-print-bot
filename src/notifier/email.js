import nodemailer from 'nodemailer';
import config from '../config.js';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.notification.email.host,
            port: config.notification.email.port,
            secure: false,
            auth: {
                user: config.notification.email.user,
                pass: config.notification.email.pass
            }
        });
    }
    return transporter;
}

export async function sendFailureNotification(task) {
    const transporter = getTransporter();

    const mailOptions = {
        from: config.notification.email.user,
        to: config.notification.email.to,
        subject: `【打印失败】${task.file_name}`,
        text: `
电子票据打印失败

票据名称：${task.file_name}
票据ID：${task.invoice_id}
失败原因：${task.error_msg}
重试次数：${task.retry_count}

请登录管理后台处理：http://localhost:3000
        `.trim()
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

export default { sendFailureNotification };