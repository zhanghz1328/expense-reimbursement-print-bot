import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../config.yaml');
const configContent = fs.readFileSync(configPath, 'utf-8');
const config = yaml.load(configContent);

export default config;