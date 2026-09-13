import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
const file = process.argv[2];
const db = await open({ filename: file, driver: sqlite3.Database });
const tables = ['users', 'hazards', 'hazard_reports', 'educational_resources', 'quizzes', 'questions', 'notifications'];
const out = {};
for (const t of tables) out[t] = (await db.get(`SELECT COUNT(*) c FROM ${t}`)).c;
console.log(JSON.stringify(out));
await db.close();
