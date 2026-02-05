/**
 * 7-Eleven Shift Manager - Database Setup (sql.js)
 * SQLite database initialization and schema
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Database file path
const DB_PATH = path.join(__dirname, 'shift_manager.db');

async function setupDatabase() {
  console.log('🗄️  Initializing database...');

  const SQL = await initSqlJs();

  // Create new database
  const db = new SQL.Database();

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // ============================================
  // Create Tables
  // ============================================

  // Users table (employees & managers)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT CHECK(role IN ('manager', 'employee')) DEFAULT 'employee',
      phone TEXT,
      email TEXT,
      avatar TEXT,
      start_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tasks table
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'check',
      shift_type TEXT CHECK(shift_type IN ('morning', 'afternoon', 'night', 'all')) DEFAULT 'all',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Shifts table
  db.run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shift_date DATE NOT NULL,
      shift_type TEXT CHECK(shift_type IN ('morning', 'afternoon', 'night')) NOT NULL,
      status TEXT CHECK(status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Shift tasks (which tasks are assigned to a shift)
  db.run(`
    CREATE TABLE IF NOT EXISTS shift_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      is_completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  // Activity log
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action_type TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('✅ Tables created successfully');

  // ============================================
  // Seed Data
  // ============================================

  console.log('📝 Seeding initial data...');

  // Hash password
  const passwordHash = bcrypt.hashSync('1234', 10);

  // Insert users
  const users = [
    ['admin', passwordHash, 'ผู้จัดการร้าน', 'manager', '081-234-5678', 'ผ'],
    ['emp001', passwordHash, 'สมชาย ใจดี', 'employee', '082-345-6789', 'ส'],
    ['emp002', passwordHash, 'สมหญิง รักงาน', 'employee', '083-456-7890', 'ส'],
    ['emp003', passwordHash, 'วิชัย มั่นคง', 'employee', '084-567-8901', 'ว'],
    ['emp004', passwordHash, 'นิดา สุขใจ', 'employee', '085-678-9012', 'น'],
    ['emp005', passwordHash, 'ประสิทธิ์ เก่งงาน', 'employee', '086-789-0123', 'ป'],
  ];

  users.forEach(user => {
    db.run(`
      INSERT INTO users (employee_id, password_hash, name, role, phone, avatar)
      VALUES (?, ?, ?, ?, ?, ?)
    `, user);
  });
  console.log(`  - ${users.length} users created`);

  // Insert tasks
  const tasks = [
    ['เปิดร้าน', 'เตรียมร้านก่อนเปิดขาย', 'door-open', 'morning'],
    ['เช็คสต๊อก', 'ตรวจนับสินค้าในร้าน', 'clipboard-check', 'all'],
    ['รับของ', 'รับสินค้าจาก DC', 'truck', 'morning'],
    ['จัดเรียงสินค้า', 'จัดเรียงสินค้าบนชั้นวาง', 'box', 'all'],
    ['ทำความสะอาด', 'ทำความสะอาดพื้นที่ร้าน', 'broom', 'all'],
    ['ปิดร้าน', 'ปิดร้านและสรุปยอด', 'door-closed', 'night'],
    ['แคชเชียร์', 'รับชำระเงินที่เคาน์เตอร์', 'cash-register', 'all'],
    ['ทำอาหาร', 'เตรียมอาหารสด เช่น ข้าวกล่อง', 'utensils', 'all'],
    ['ชงกาแฟ', 'บริการเครื่องดื่ม All Cafe', 'coffee', 'all'],
    ['เติมสินค้า', 'เติมสินค้าในตู้แช่และชั้นวาง', 'box', 'all'],
  ];

  tasks.forEach(task => {
    db.run(`
      INSERT INTO tasks (name, description, icon, shift_type)
      VALUES (?, ?, ?, ?)
    `, task);
  });
  console.log(`  - ${tasks.length} tasks created`);

  // Insert sample shifts for today
  const today = new Date().toISOString().split('T')[0];

  // Morning shift
  db.run('INSERT INTO shifts (user_id, shift_date, shift_type) VALUES (?, ?, ?)', [2, today, 'morning']);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [1, 1]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [1, 3]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [1, 7]);

  db.run('INSERT INTO shifts (user_id, shift_date, shift_type) VALUES (?, ?, ?)', [3, today, 'morning']);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [2, 2]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [2, 4]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [2, 9]);

  // Afternoon shift
  db.run('INSERT INTO shifts (user_id, shift_date, shift_type) VALUES (?, ?, ?)', [4, today, 'afternoon']);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [3, 7]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [3, 8]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [3, 10]);

  db.run('INSERT INTO shifts (user_id, shift_date, shift_type) VALUES (?, ?, ?)', [5, today, 'afternoon']);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [4, 4]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [4, 5]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [4, 9]);

  // Night shift
  db.run('INSERT INTO shifts (user_id, shift_date, shift_type) VALUES (?, ?, ?)', [6, today, 'night']);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [5, 7]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [5, 5]);
  db.run('INSERT INTO shift_tasks (shift_id, task_id) VALUES (?, ?)', [5, 6]);

  console.log('  - Sample shifts created for today');

  // Save database to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);

  console.log('✅ Seed data created successfully');
  console.log('🎉 Database setup complete!');
  console.log(`📍 Database location: ${DB_PATH}`);

  db.close();
}

// Run setup
setupDatabase().catch(console.error);
