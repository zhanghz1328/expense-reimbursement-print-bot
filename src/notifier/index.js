import { sendFailureNotification as sendEmail } from './email.js';
import { sendTeamsNotification as sendTeams } from './teams.js';

export async function notifyFailure(task) {
    const results = await Promise.allSettled([
        sendEmail(task),
        sendTeams(task)
    ]);

    return {
        email: results[0].status === 'fulfilled' ? results[0].value : results[0].reason,
        teams: results[1].status === 'fulfilled' ? results[1].value : results[1].reason
    };
}

export default { notifyFailure };