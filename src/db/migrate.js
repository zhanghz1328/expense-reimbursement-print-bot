import db from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationPath = join(__dirname, 'migrations/001_create_tasks.sql');
const sql = readFileSync(migrationPath, 'utf-8');

db.exec(sql);
console.log('Migration completed successfully');