import { dbStatus } from '../config/db.js';

export function getHealth(req, res) {
  res.json({
    status: 'ok',
    database: dbStatus(),
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
