// server/node-server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail');

// 读取 CI 写好的 project.env
dotenv.config({ path: 'project.env' });

// 配置 SendGrid（如果没配好，只是打个 warning，不会影响接口返回）
if (!process.env.SENDGRID_API_KEY) {
  console.warn('⚠️ SENDGRID_API_KEY is not set. Emails will NOT actually be sent.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ===== 中间件 =====
app.use(cors({
  origin: [
    'https://baicloud.miever.net',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  credentials: false
}));
app.use(express.json());

// ===== 内存里的“数据库” =====
const verificationCodes = new Map(); // email -> { code, expiresAt }
const users = [];                     // 简单用户表：{ id, username, email, passwordHash }

// ===== 工具函数 =====
function isAaltoEmail(email) {
  return email.trim().toLowerCase().endsWith('@aalto.fi');
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashPassword(plain) {
  // 先用简单 hash，后面你要真上生产再换 bcrypt/scrypt
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(plain).digest('hex');
}

// ====== Mock 任务接口（跟你之前的一样）======

let tasks = [
  {
    id: '1',
    name: 'Package Pickup from A Bloc',
    description: 'Need someone to pick up a package from the post office at A Bloc. The package is from Amazon and I can provide the tracking number.',
    time: new Date('2025-01-15T10:30:00Z').toISOString(),
    completed: false
  },
  {
    id: '2',
    name: 'Print Documents at Library',
    description: 'Need 20 pages printed for my thesis. I have the PDF files ready and can send them via email.',
    time: new Date('2025-01-15T14:15:00Z').toISOString(),
    completed: false
  },
  {
    id: '3',
    name: 'Grocery Shopping at K-Citymarket',
    description: 'Small grocery run to K-Citymarket Otaniemi. I have a shopping list and can provide payment.',
    time: new Date('2025-01-14T16:45:00Z').toISOString(),
    completed: true
  },
  {
    id: '4',
    name: 'Lend Calculator for Exam',
    description: 'Need to borrow a scientific calculator for my math exam tomorrow. Will return it the same day.',
    time: new Date('2025-01-14T09:20:00Z').toISOString(),
    completed: false
  },
  {
    id: '5',
    name: 'Deliver Books to B Bloc',
    description: 'Need someone to deliver 3 textbooks to a friend at B Bloc. Books are ready for pickup.',
    time: new Date('2025-01-13T11:00:00Z').toISOString(),
    completed: true
  },
  {
    id: '6',
    name: 'Help with Moving Boxes',
    description: 'Need help carrying 5 boxes from my dorm to a friend\'s apartment. Should take about 30 minutes.',
    time: new Date('2025-01-13T13:30:00Z').toISOString(),
    completed: false
  }
];

app.get('/tasks', (req, res) => {
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

app.post('/tasks', (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: 'Name and description are required' });
  }

  const newTask = {
    id: (tasks.length + 1).toString(),
    name,
    description,
    time: new Date().toISOString(),
    completed: false
  };

  tasks.unshift(newTask);
  res.status(201).json(newTask);
});

app.post('/tasks/:id', (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { name, description } = req.body;
  tasks[taskIndex] = {
    ...tasks[taskIndex],
    name: name || tasks[taskIndex].name,
    description: description || tasks[taskIndex].description,
    time: new Date().toISOString()
  };

  res.json(tasks[taskIndex]);
});

app.post('/tasks/:id/delete', (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks.splice(taskIndex, 1);
  res.json({ message: 'Task deleted successfully' });
});

// ====== Auth: 发送验证码 ======

app.post('/auth/send-code', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isAaltoEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please use your Aalto email (@aalto.fi)' });
  }

  const code = generateVerificationCode();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 分钟

  verificationCodes.set(normalizedEmail, { code, expiresAt });

  console.log(`📧 Generated verification code ${code} for ${normalizedEmail}`);

  // 构造邮件
  const msg = {
    to: normalizedEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME || 'HandyGO',
    },
    subject: 'Your HandyGO Verification Code',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is:</p>
           <h2>${code}</h2>
           <p>This code will expire in 5 minutes.</p>`
  };

  if (process.env.SENDGRID_API_KEY) {
    sgMail
      .send(msg)
      .then(() => console.log(`📧 Email sent to ${normalizedEmail}`))
      .catch((err) => console.error('SendGrid error:', err));
  } else {
    console.warn('⚠️ SENDGRID_API_KEY not set, email not actually sent.');
  }

  return res.json({
    message: 'Verification code sent (or will be sent if email is configured)'
  });
});

// ====== Auth: 校验验证码 ======

app.post('/auth/verify-code', (req, res) => {
  const { email, code } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const stored = verificationCodes.get(normalizedEmail);

  if (!stored) {
    return res.status(400).json({ error: 'No verification code for this email' });
  }

  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(normalizedEmail);
    return res.status(400).json({ error: 'Verification code has expired' });
  }

  if (stored.code !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  verificationCodes.delete(normalizedEmail);
  return res.json({ message: 'Verification code is valid' });
});

// ====== Auth: 注册 ======

app.post('/auth/registration', (req, res) => {
  const { username, email, password, verificationCode } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!isAaltoEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please use an Aalto email address (@aalto.fi)' });
  }

  const stored = verificationCodes.get(normalizedEmail);
  if (!stored || stored.code !== verificationCode || Date.now() > stored.expiresAt) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }

  if (users.some(u => u.email === normalizedEmail)) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const newUser = {
    id: (users.length + 1).toString(),
    username: username.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password.trim())
  };

  users.push(newUser);
  verificationCodes.delete(normalizedEmail);

  return res.json({
    message: 'Registration success',
    user: { id: newUser.id, username: newUser.username, email: newUser.email }
  });
});

// ====== Auth: 登录（简单版）======

app.post('/auth/login', (req, res) => {
  const { email, password, username } = req.body || {};

  let user = null;
  if (email) {
    user = users.find(u => u.email === email.trim().toLowerCase());
  } else if (username) {
    user = users.find(u => u.username === username.trim());
  } else {
    return res.status(400).json({ error: 'Email or username is required' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email/username or password' });
  }

  if (user.passwordHash !== hashPassword(String(password || ''))) {
    return res.status(401).json({ error: 'Invalid email/username or password' });
  }

  // 暂时不做真正 Session，前端只要拿到 user 就行
  return res.json({
    message: `Logged in as ${user.email}`,
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

// ====== Auth: 其它接口简单占位 ======

app.post('/auth/logout', (req, res) => {
  // 没有真正 session，就返回成功
  return res.json({ message: 'Logged out (dummy)' });
});

app.get('/auth/session', (req, res) => {
  // 先统一认为没有登录
  return res.json({ user: null });
});

// ===== Health check =====

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== 启动服务 =====

app.listen(PORT, () => {
  console.log(`🚀 HandyGO Backend Server running on http://localhost:${PORT}`);
  console.log('📋 Endpoints:');
  console.log('   GET  /tasks');
  console.log('   GET  /tasks/:id');
  console.log('   POST /tasks');
  console.log('   POST /tasks/:id');
  console.log('   POST /tasks/:id/delete');
  console.log('   POST /auth/send-code');
  console.log('   POST /auth/verify-code');
  console.log('   POST /auth/registration');
  console.log('   POST /auth/login');
  console.log('   POST /auth/logout');
  console.log('   GET  /auth/session');
  console.log('   GET  /health');
});