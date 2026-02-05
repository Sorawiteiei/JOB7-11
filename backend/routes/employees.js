/**
 * 7-Eleven Shift Manager - Employees Routes
 * CRUD operations for employees
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authMiddleware, managerOnly } = require('./auth');

// ============================================
// Get All Employees
// ============================================
router.get('/', (req, res) => {
    try {
        const employees = db.prepare(`
      SELECT id, employee_id, name, role, phone, email, avatar, start_date, is_active, created_at
      FROM users
      WHERE is_active = 1
      ORDER BY name
    `).all();

        res.json(employees.map(emp => ({
            id: emp.id,
            employeeId: emp.employee_id,
            name: emp.name,
            role: emp.role,
            phone: emp.phone,
            email: emp.email,
            avatar: emp.avatar,
            startDate: emp.start_date,
            createdAt: emp.created_at
        })));

    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Get Single Employee
// ============================================
router.get('/:id', (req, res) => {
    try {
        const employee = db.prepare(`
      SELECT id, employee_id, name, role, phone, email, avatar, start_date, created_at
      FROM users
      WHERE id = ? AND is_active = 1
    `).get(req.params.id);

        if (!employee) {
            return res.status(404).json({ error: 'ไม่พบพนักงาน' });
        }

        // Get shift statistics
        const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalShifts,
        SUM(CASE WHEN shift_type = 'morning' THEN 1 ELSE 0 END) as morningShifts,
        SUM(CASE WHEN shift_type = 'afternoon' THEN 1 ELSE 0 END) as afternoonShifts,
        SUM(CASE WHEN shift_type = 'night' THEN 1 ELSE 0 END) as nightShifts
      FROM shifts
      WHERE user_id = ? AND shift_date >= date('now', '-30 days')
    `).get(req.params.id);

        res.json({
            id: employee.id,
            employeeId: employee.employee_id,
            name: employee.name,
            role: employee.role,
            phone: employee.phone,
            email: employee.email,
            avatar: employee.avatar,
            startDate: employee.start_date,
            createdAt: employee.created_at,
            statistics: stats
        });

    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Create Employee (Manager only)
// ============================================
router.post('/', (req, res) => {
    try {
        const { employeeId, password, name, role, phone, email, startDate } = req.body;

        // Validate required fields
        if (!employeeId || !password || !name) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        // Check if employee ID already exists
        const existing = db.prepare('SELECT id FROM users WHERE employee_id = ?').get(employeeId);
        if (existing) {
            return res.status(400).json({ error: 'รหัสพนักงานนี้มีอยู่แล้ว' });
        }

        // Hash password
        const passwordHash = bcrypt.hashSync(password, 10);

        // Get first character of name for avatar
        const avatar = name.charAt(0);

        // Insert employee
        const result = db.prepare(`
      INSERT INTO users (employee_id, password_hash, name, role, phone, email, avatar, start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(employeeId, passwordHash, name, role || 'employee', phone, email, avatar, startDate);

        res.status(201).json({
            success: true,
            id: result.lastInsertRowid,
            message: 'เพิ่มพนักงานเรียบร้อย'
        });

    } catch (error) {
        console.error('Create employee error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Update Employee (Manager only)
// ============================================
router.put('/:id', (req, res) => {
    try {
        const { employeeId, name, role, phone, email, startDate, password } = req.body;
        const id = req.params.id;

        // Check if employee exists
        const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบพนักงาน' });
        }

        // Check if new employee ID conflicts with another user
        if (employeeId) {
            const conflict = db.prepare('SELECT id FROM users WHERE employee_id = ? AND id != ?').get(employeeId, id);
            if (conflict) {
                return res.status(400).json({ error: 'รหัสพนักงานนี้มีผู้ใช้อื่นแล้ว' });
            }
        }

        // Update basic info
        let query = `
      UPDATE users SET 
        employee_id = COALESCE(?, employee_id),
        name = COALESCE(?, name),
        role = COALESCE(?, role),
        phone = ?,
        email = ?,
        start_date = ?,
        avatar = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

        const avatar = name ? name.charAt(0) : null;
        db.prepare(query).run(employeeId, name, role, phone, email, startDate, avatar, id);

        // Update password if provided
        if (password) {
            const passwordHash = bcrypt.hashSync(password, 10);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
        }

        res.json({ success: true, message: 'แก้ไขข้อมูลพนักงานเรียบร้อย' });

    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// ============================================
// Delete Employee (Soft delete, Manager only)
// ============================================
router.delete('/:id', (req, res) => {
    try {
        const id = req.params.id;

        // Check if employee exists
        const existing = db.prepare('SELECT id, name FROM users WHERE id = ? AND is_active = 1').get(id);
        if (!existing) {
            return res.status(404).json({ error: 'ไม่พบพนักงาน' });
        }

        // Soft delete
        db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

        res.json({ success: true, message: `ลบพนักงาน ${existing.name} เรียบร้อย` });

    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

module.exports = router;
