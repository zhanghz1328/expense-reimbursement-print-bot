import { Router } from 'express';
import { getStats } from '../../queue/index.js';

const router = Router();

router.get('/', (req, res) => {
    const stats = getStats();
    res.json({ success: true, data: stats });
});

export default router;