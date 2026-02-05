/**
 * 7-Eleven Shift Manager - Shifts Routes
 * CRUD operations for shifts/schedules
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// ============================================
// Get Shifts by Date
// ============================================
router.get('/date/:date', (req, res) => {
    try {
        const { date } = req.params;

        const shifts = db.prepare(`
      SELECT 
        s.id,
        s.user_id,
        s.shift_date,
        s.shift_type,
        s.status,
        s.notes,
        u.name as employee_name,
        u.avatar as employee_avatar
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.shift_date = ?
      ORDER BY 
        CASE s.shift_type 
          WHEN 'morning' THEN 1 
          WHEN 'afternoon' THEN 2 
          WHEN 'night' THEN 3 
        END
    `).all(date);

        // Get tasks for each shift
        const shiftsWithTasks = shifts.map(shift => {
            const tasks = db.prepare(`
        SELECT t.id, t.name, t.icon, st.is_completed
        FROM shift_tasks st
        JOIN tasks t ON st.task_id = t.id
        WHERE st.shift_id = ?
      `).all(shift.id);

            return { ...shift, tasks };
        });

        // Group by shift type
        const grouped = {
            morning: shiftsWithTasks.filter(s => s.shift_type === 'morning'),
            afternoon: shiftsWithTasks.filter(s => s.shift_type === 'afternoon'),
            night: shiftsWithTasks.filter(s => s.shift_type === 'night')
        };

        res.json(grouped);

    } catch (error) {
        console.error('Get shifts error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Get Shifts by Week
// ============================================
router.get('/week/:startDate', (req, res) => {
    try {
        const { startDate } = req.params;

        const shifts = db.prepare(`
      SELECT 
        s.id,
        s.user_id,
        s.shift_date,
        s.shift_type,
        s.status,
        u.name as employee_name,
        u.avatar as employee_avatar
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.shift_date >= ? AND s.shift_date < date(?, '+7 days')
      ORDER BY s.shift_date, s.shift_type
    `).all(startDate, startDate);

        res.json(shifts);

    } catch (error) {
        console.error('Get week shifts error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Get Shifts by Employee
// ============================================
router.get('/employee/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { month } = req.query;

        let query = `
      SELECT 
        s.id,
        s.shift_date,
        s.shift_type,
        s.status,
        s.notes
      FROM shifts s
      WHERE s.user_id = ?
    `;

        const params = [userId];

        if (month) {
            query += ` AND strftime('%Y-%m', s.shift_date) = ?`;
            params.push(month);
        }

        query += ` ORDER BY s.shift_date DESC`;

        const shifts = db.prepare(query).all(...params);

        // Get tasks for each shift
        const shiftsWithTasks = shifts.map(shift => {
            const tasks = db.prepare(`
        SELECT t.id, t.name, st.is_completed
        FROM shift_tasks st
        JOIN tasks t ON st.task_id = t.id
        WHERE st.shift_id = ?
      `).all(shift.id);

            return { ...shift, tasks };
        });

        res.json(shiftsWithTasks);

    } catch (error) {
        console.error('Get employee shifts error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Create Shift
// ============================================
router.post('/', (req, res) => {
    try {
        const { userId, shiftDate, shiftType, tasks, notes } = req.body;

        // Validate required fields
        if (!userId || !shiftDate || !shiftType) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        // Check if employee already has a shift on this date and type
        const existing = db.prepare(`
      SELECT id FROM shifts 
      WHERE user_id = ? AND shift_date = ? AND shift_type = ?
    `).get(userId, shiftDate, shiftType);

        if (existing) {
            return res.status(400).json({ error: 'พนักงานมีกะนี้แล้วในวันที่เลือก' });
        }

        // Insert shift
        const result = db.prepare(`
      INSERT INTO shifts (user_id, shift_date, shift_type, notes)
      VALUES (?, ?, ?, ?)
    `).run(userId, shiftDate, shiftType, notes);

        const shiftId = result.lastInsertRowid;

        // Insert shift tasks
        if (tasks && tasks.length > 0) {
            const insertTask = db.prepare(`
        INSERT INTO shift_tasks (shift_id, task_id)
        VALUES (?, ?)
      `);

            tasks.forEach(taskId => {
                insertTask.run(shiftId, taskId);
            });
        }

        // Log activity
        const employee = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
        db.prepare(`
      INSERT INTO activity_log (user_id, action_type, description)
      VALUES (?, 'shift_created', ?)
    `).run(userId, `เพิ่มกะ ${shiftType} ให้ ${employee.name} วันที่ ${shiftDate}`);

        res.status(201).json({
            success: true,
            id: shiftId,
            message: 'เพิ่มกะงานเรียบร้อย'
        });

    } catch (error) {
        console.error('Create shift error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Update Shift
// ============================================
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { shiftType, tasks, notes, status } = req.body;

        // Check if shift exists
        const existing = db.prepare('SELECT id FROM shifts WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบกะงาน' });
        }

        // Update shift
        db.prepare(`
      UPDATE shifts SET 
        shift_type = COALESCE(?, shift_type),
        notes = ?,
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(shiftType, notes, status, id);

        // Update tasks if provided
        if (tasks) {
            // Delete existing tasks
            db.prepare('DELETE FROM shift_tasks WHERE shift_id = ?').run(id);

            // Insert new tasks
            const insertTask = db.prepare(`
        INSERT INTO shift_tasks (shift_id, task_id)
        VALUES (?, ?)
      `);

            tasks.forEach(taskId => {
                insertTask.run(id, taskId);
            });
        }

        res.json({ success: true, message: 'แก้ไขกะงานเรียบร้อย' });

    } catch (error) {
        console.error('Update shift error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Delete Shift
// ============================================
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        // Check if shift exists
        const existing = db.prepare('SELECT id FROM shifts WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบกะงาน' });
        }

        // Delete shift (cascade will delete shift_tasks)
        db.prepare('DELETE FROM shifts WHERE id = ?').run(id);

        res.json({ success: true, message: 'ลบกะงานเรียบร้อย' });

    } catch (error) {
        console.error('Delete shift error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Complete Task
// ============================================
router.post('/:shiftId/tasks/:taskId/complete', (req, res) => {
    try {
        const { shiftId, taskId } = req.params;
        const { completed } = req.body;

        db.prepare(`
      UPDATE shift_tasks SET 
        is_completed = ?,
        completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE shift_id = ? AND task_id = ?
    `).run(completed ? 1 : 0, completed ? 1 : 0, shiftId, taskId);

        res.json({ success: true, message: completed ? 'ทำงานเสร็จแล้ว' : 'ยกเลิกสถานะเสร็จ' });

    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

module.exports = router;
