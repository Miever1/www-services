const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const sgMail = require('@sendgrid/mail');

// 1. 读取 project.env（CI 已经帮你在服务器生成了这个文件）
dotenv.config({ path: 'project.env' });

// 2. 配置 SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.warn('⚠️ SENDGRID_API_KEY is not set. /auth/send-code will fail.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data for demo
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

// Routes
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

app.post('/auth/send-code', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.endsWith("@aalto.fi")) {
    return res.status(400).json({ error: "Please use your Aalto email (@aalto.fi)" });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  verificationCodes.set(normalizedEmail, { code, expiresAt });

  // 先不真正发邮件，防止卡住
  console.log(`📧 [DEV] Generated verification code ${code} for ${normalizedEmail}`);

  return res.json({
    message: "Verification code generated (dev mode)",
    code,
    devMode: true
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 HandyGO Backend Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /tasks - List all tasks`);
  console.log(`   GET  /tasks/:id - Get specific task`);
  console.log(`   POST /tasks - Create new task`);
  console.log(`   POST /tasks/:id - Update task`);
  console.log(`   POST /tasks/:id/delete - Delete task`);
  console.log(`   GET  /health - Health check`);
});










