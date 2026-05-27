const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const port = 3001;
const SECRET_KEY = 'super_secret_key_change_in_production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// WhatsApp Notification via CallMeBot
// ⚡ To activate: Send this message to +34 644 59 77 59 on WhatsApp:
//    "I allow callmebot to send me messages"
// Then set your API key below:
const WHATSAPP_PHONE = '963991293755'; // رقمك بدون +
const CALLMEBOT_APIKEY = 'YOUR_APIKEY_HERE'; // ضع مفتاح API الخاص بك هنا

function sendWhatsAppNotification(message) {
    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_PHONE}&text=${encodedMessage}&apikey=${CALLMEBOT_APIKEY}`;

    https.get(url, (res) => {
        console.log(`WhatsApp notification sent. Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('WhatsApp notification error:', err.message);
    });
}

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Database connected');
        // Create Tables
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user',
            balance REAL DEFAULT 0
        )`, (err) => {
            if (!err) {
                // Insert default admin if not exists
                bcrypt.hash('admin123', 10, (err, hash) => {
                    db.get(`SELECT * FROM users WHERE username = 'admin'`, (err, row) => {
                        if (!row) {
                            db.run(`INSERT INTO users (username, password, role, balance) VALUES ('admin', ?, 'admin', 0)`, [hash]);
                        }
                    });
                });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            service TEXT,
            package TEXT,
            price REAL,
            player_id TEXT,
            status TEXT DEFAULT 'pending',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`ALTER TABLE users ADD COLUMN balance_syp REAL DEFAULT 0`, (err) => {
            // Ignore error if column already exists
        });

        db.run(`CREATE TABLE IF NOT EXISTS topup_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            currency TEXT,
            amount REAL,
            method TEXT,
            receipt_image TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            image TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            amount INTEGER,
            name TEXT,
            price REAL,
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )`, (err) => {
            if (!err) {
                // Seed initial data if empty
                db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
                    if (row && row.count === 0) {
                        // Insert Categories
                        db.run("INSERT INTO categories (name, image) VALUES ('ببجي موبايل (PUBG)', 'pubg.png')"); // 1
                        db.run("INSERT INTO categories (name, image) VALUES ('فري فاير (Free Fire)', 'freefire.png')"); // 2
                        db.run("INSERT INTO categories (name, image) VALUES ('تعبئة رصيد (سيريتل - MTN)', 'mobile.png')"); // 3
                        db.run("INSERT INTO categories (name, image) VALUES ('فواتير هاتف أرضي و إنترنت', 'phone.png')"); // 4
                        db.run("INSERT INTO categories (name, image) VALUES ('فواتير كهرباء وماء', 'electricity.png')"); // 5
                        db.run("INSERT INTO categories (name, image) VALUES ('تحويل إلى شام كاش (Cham Cash)', 'chamcash.png')"); // 6
                        db.run("INSERT INTO categories (name, image) VALUES ('سيريتل كاش / كاش موبايل', 'syriatelcash.png')"); // 7
                        db.run("INSERT INTO categories (name, image) VALUES ('رسوم إلكترونية (جواز سفر، الخ)', 'gov.png')"); // 8

                        setTimeout(() => {
                            // PUBG
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (1, 60, '60 UC', 1.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (1, 325, '325 UC', 5.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (1, 660, '660 UC', 10.00)");
                            // Free Fire
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (2, 100, '100 جواهر', 1.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (2, 530, '530 جواهر', 5.00)");
                            // Mobile Balance
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (3, 1000, 'تعبئة 1000 ل.س', 1.50)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (3, 5000, 'تعبئة 5000 ل.س', 7.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (3, 10000, 'تعبئة 10000 ل.س', 13.50)");
                            // Landline & Internet
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (4, 0, 'دفع فاتورة هاتف (حدد المبلغ في الملاحظات)', 1.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (4, 0, 'تجديد باقة إنترنت تراسل', 5.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (4, 0, 'تجديد باقة أمنية / آية', 6.00)");
                            // Electricity & Water
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (5, 0, 'دفع فاتورة كهرباء دمشق / ريف دمشق', 2.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (5, 0, 'دفع فاتورة مياه', 1.50)");
                            // Cham Cash
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (6, 5000, 'تحويل 5000 ل.س إلى شام كاش', 7.50)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (6, 10000, 'تحويل 10000 ل.س إلى شام كاش', 14.50)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (6, 50000, 'تحويل 50000 ل.س إلى شام كاش', 72.00)");
                            // Syriatel Cash / MTN Cash
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (7, 10000, 'تحويل 10000 ل.س سيريتل كاش', 14.50)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (7, 10000, 'تحويل 10000 ل.س كاش موبايل (MTN)', 14.50)");
                            // E-Gov
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (8, 0, 'دفع رسوم جواز السفر الإلكتروني', 15.00)");
                            db.run("INSERT INTO packages (category_id, amount, name, price) VALUES (8, 0, 'تسديد رسوم الجامعة', 10.00)");
                        }, 500);
                    }
                });
            }
        });
    }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    next();
};

// Routes

// Auth Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
            if (err) return res.status(400).json({ error: 'Username already exists' });
            res.json({ message: 'User created successfully', id: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, balance: user.balance, balance_syp: user.balance_syp || 0 } });
    });
});

app.get('/api/user', authenticateToken, (req, res) => {
    db.get(`SELECT id, username, role, balance, balance_syp FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

// Services API
app.get('/api/categories', (req, res) => {
    db.all(`SELECT * FROM categories`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/categories/:id/packages', (req, res) => {
    db.all(`SELECT * FROM packages WHERE category_id = ?`, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Orders API
app.post('/api/orders', authenticateToken, (req, res) => {
    const { category_id, package_id, player_id } = req.body;

    // Get package details
    db.get(`SELECT p.*, c.name as category_name FROM packages p JOIN categories c ON p.category_id = c.id WHERE p.id = ?`, [package_id], (err, pkg) => {
        if (err || !pkg) return res.status(404).json({ error: 'Package not found' });

        // Check user balance
        db.get(`SELECT balance FROM users WHERE id = ?`, [req.user.id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });

            if (user.balance < pkg.price) {
                return res.status(400).json({ error: 'Insufficient balance' });
            }

            // Deduct balance and create order
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run(`UPDATE users SET balance = balance - ? WHERE id = ?`, [pkg.price, req.user.id]);
                db.run(`INSERT INTO orders (user_id, service, package, price, player_id) VALUES (?, ?, ?, ?, ?)`,
                    [req.user.id, pkg.category_name, pkg.name, pkg.price, player_id], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to create order' });
                        }
                        db.run('COMMIT');
                        res.json({ message: 'Order created successfully', orderId: this.lastID });

                        // Send WhatsApp Notification via CallMeBot (background, silent)
                        const notifyMsg = `🔔 طلب جديد على موقع SLS!\n- رقم الطلب: #${this.lastID}\n- الخدمة: ${pkg.category_name}\n- الباقة: ${pkg.name}\n- المعرف / الآي دي: ${player_id}\n- السعر: $${pkg.price}\n\nيرجى الدخول للوحة التحكم لتنفيذ الطلب.`;
                        sendWhatsAppNotification(notifyMsg);
                    });
            });
        });
    });
});

app.get('/api/my-orders', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/top-up', authenticateToken, (req, res) => {
    const { currency, method, amount, receipt_image } = req.body;
    db.run(`INSERT INTO topup_requests (user_id, currency, amount, method, receipt_image) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, currency, amount, method, receipt_image], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to create top-up request' });
            res.json({ message: 'Top-up request created successfully', id: this.lastID });
            const notifyMsg = `🔔 طلب شحن رصيد جديد!\n- رقم الطلب: #${this.lastID}\n- العملة: ${currency}\n- المبلغ: ${amount}\n- الطريقة: ${method}\n\nيرجى الدخول للوحة التحكم للمراجعة.`;
            sendWhatsAppNotification(notifyMsg);
        });
});

// Admin API
app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
    db.all(`SELECT id, username, role, balance, balance_syp FROM users ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/users/:id/balance', authenticateToken, isAdmin, (req, res) => {
    const { amount, currency } = req.body;
    const balanceCol = currency === 'SYP' ? 'balance_syp' : 'balance';
    db.run(`UPDATE users SET ${balanceCol} = IFNULL(${balanceCol}, 0) + ? WHERE id = ?`, [amount, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Balance updated successfully' });
    });
});

app.post('/api/admin/users/create', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
            if (err) return res.status(400).json({ error: 'Username already exists' });
            res.json({ message: 'User created successfully', id: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/orders', authenticateToken, isAdmin, (req, res) => {
    db.all(`SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/orders/:id/status', authenticateToken, isAdmin, (req, res) => {
    const { status, notes } = req.body; // status: 'pending', 'accepted', 'rejected'

    if (status === 'rejected') {
        // Refund logic
        db.get(`SELECT user_id, price, status FROM orders WHERE id = ?`, [req.params.id], (err, order) => {
            if (err || !order) return res.status(404).json({ error: 'Order not found' });

            if (order.status !== 'rejected') {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [order.price, order.user_id]);
                    db.run(`UPDATE orders SET status = ?, notes = ? WHERE id = ?`, [status, notes || '', req.params.id], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to update' });
                        }
                        db.run('COMMIT');
                        res.json({ message: 'Order rejected and refunded' });
                    });
                });
            } else {
                res.json({ message: 'Order already rejected' });
            }
        });
    } else {
        db.run(`UPDATE orders SET status = ?, notes = ? WHERE id = ?`, [status, notes || '', req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Order status updated' });
        });
    }
});

app.get('/api/admin/topups', authenticateToken, isAdmin, (req, res) => {
    db.all(`SELECT t.*, u.username FROM topup_requests t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/admin/topups/:id/status', authenticateToken, isAdmin, (req, res) => {
    const { status, notes } = req.body; // 'accepted' or 'rejected'
    db.get(`SELECT * FROM topup_requests WHERE id = ?`, [req.params.id], (err, request) => {
        if (err || !request) return res.status(404).json({ error: 'Request not found' });

        if (request.status === 'pending' && status === 'accepted') {
            const balanceCol = request.currency === 'SYP' ? 'balance_syp' : 'balance';
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run(`UPDATE users SET ${balanceCol} = IFNULL(${balanceCol}, 0) + ? WHERE id = ?`, [request.amount, request.user_id]);
                db.run(`UPDATE topup_requests SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Failed to update' });
                    }
                    db.run('COMMIT');
                    res.json({ message: 'Request accepted and balance updated' });
                });
            });
        } else {
            db.run(`UPDATE topup_requests SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Request status updated' });
            });
        }
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
