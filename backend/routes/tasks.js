/**
 * 7-Eleven Shift Manager - Tasks Routes
 * CRUD operations for task types
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// ============================================
// Get All Tasks
// ============================================
router.get('/', (req, res) => {
    try {
        const { shift } = req.query;

        let query = `
      SELECT id, name, description, icon, shift_type as shift, is_active, created_at
      FROM tasks
      WHERE is_active = 1
    `;

        const params = [];

        if (shift) {
            query += ` AND shift_type = ?`;
            params.push(shift);
        }

        query += ` ORDER BY shift_type, name`;

        const tasks = db.prepare(query).all(...params);

        res.json(tasks);

    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Get Single Task
// ============================================
router.get('/:id', (req, res) => {
    try {
        const task = db.prepare(`
      SELECT id, name, description, icon, shift_type as shift, is_active, created_at
      FROM tasks
      WHERE id = ? AND is_active = 1
    `).get(req.params.id);

        if (!task) {
            return res.status(404).json({ error: 'ไม่พบงาน' });
        }

        res.json(task);

    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Create Task
// ============================================
router.post('/', (req, res) => {
    try {
        const { name, description, icon, shift } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'กรุณากรอกชื่องาน' });
        }

        // Insert task
        const result = db.prepare(`
      INSERT INTO tasks (name, description, icon, shift_type)
      VALUES (?, ?, ?, ?)
    `).run(name, description, icon || 'check', shift || 'all');

        res.status(201).json({
            success: true,
            id: result.lastInsertRowid,
            message: 'เพิ่มหน้าที่งานเรียบร้อย'
        });

    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Update Task
// ============================================
router.put('/:id', (req, res) => {
    try {
        const { name, description, icon, shift } = req.body;
        const id = req.params.id;

        // Check if task exists
        const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบงาน' });
        }

        // Update task
        db.prepare(`
      UPDATE tasks SET 
        name = COALESCE(?, name),
        description = ?,
        icon = COALESCE(?, icon),
        shift_type = COALESCE(?, shift_type)
      WHERE id = ?
    `).run(name, description, icon, shift, id);

        res.json({ success: true, message: 'แก้ไขหน้าที่งานเรียบร้อย' });

    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Delete Task (Soft delete)
// ============================================
router.delete('/:id', (req, res) => {
    try {
        const id = req.params.id;

        // Check if task exists
        const existing = db.prepare('SELECT id, name FROM tasks WHERE id = ? AND is_active = 1').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบงาน' });
        }

        // Soft delete
        db.prepare('UPDATE tasks SET is_active = 0 WHERE id = ?').run(id);

        res.json({ success: true, message: `ลบหน้าที่งาน ${existing.name} เรียบร้อย` });

    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Get Task Statistics
// ============================================
router.get('/stats/summary', (req, res) => {
    try {
        const stats = db.prepare(`
      SELECT 
        shift_type,
        COUNT(*) as count
      FROM tasks
      WHERE is_active = 1
      GROUP BY shift_type
    `).all();

        const summary = {
            morning: 0,
            afternoon: 0,
            night: 0,
            all: 0
        };

        stats.forEach(s => {
            summary[s.shift_type] = s.count;
        });

        res.json(summary);

    } catch (error) {
        console.error('Get task stats error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

module.exports = router;
