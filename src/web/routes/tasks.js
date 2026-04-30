import { Router } from 'express';
import { getAllTasks, getTaskById, updateTaskStatus } from '../../queue/index.js';
import { printPDF } from '../../printer/printServerClient.js';
import { notifyFailure } from '../../notifier/index.js';

const router = Router();

router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const tasks = getAllTasks(limit);
    res.json({ success: true, data: tasks });
});

router.get('/:id', (req, res) => {
    const task = getTaskById(req.params.id);
    if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.json({ success: true, data: task });
});

router.post('/:id/retry', async (req, res) => {
    const task = getTaskById(req.params.id);
    if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
    }

    updateTaskStatus(task.id, 'printing');

    const printResult = await printPDF(task.file_path, {
        fileName: task.file_name
    });

    if (printResult.success) {
        updateTaskStatus(task.id, 'success');
        res.json({ success: true, message: 'Print job submitted successfully' });
    } else {
        updateTaskStatus(task.id, 'failed', printResult.message);
        const updatedTask = getTaskById(task.id);
        await notifyFailure(updatedTask);
        res.json({ success: false, message: printResult.message });
    }
});

router.post('/:id/cancel', (req, res) => {
    const task = getTaskById(req.params.id);
    if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found' });
    }

    updateTaskStatus(task.id, 'failed', 'Cancelled by user');
    res.json({ success: true, message: 'Task cancelled' });
});

export default router;