/**
 * Hakobune AI — Cron Task Reminder
 * Runs daily at 9:00 AM JST (0:00 UTC) via Vercel Cron
 * Sends push notifications for due/overdue tasks
 */

import { getDueTasks } from '../lib/store.js';
import { push } from '../lib/line.js';
import { taskReminderFlex } from '../lib/flex-templates.js';

export default async function handler(req, res) {
  // Verify Vercel Cron secret (prevents unauthorized access)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const dueTasks = await getDueTasks();

    if (dueTasks.length === 0) {
      return res.status(200).json({ message: 'No due tasks', count: 0 });
    }

    // Group tasks by assigned user
    const byUser = {};
    for (const task of dueTasks) {
      const key = task.assigned_to || task.line_group_id;
      if (!byUser[key]) byUser[key] = [];
      byUser[key].push(task);
    }

    // Send push notifications to each user/group
    let sent = 0;
    for (const [target, tasks] of Object.entries(byUser)) {
      try {
        if (target && target !== 'dm') {
          await push(target, [taskReminderFlex(tasks)]);
          sent++;
        }
      } catch (err) {
        console.error(`Push failed for ${target}:`, err.message);
      }
    }

    return res.status(200).json({ message: 'Reminders sent', total: dueTasks.length, sent });
  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
