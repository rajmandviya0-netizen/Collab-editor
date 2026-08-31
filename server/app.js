require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(cors());
app.use(express.json());

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword }
  });
  res.json({ id: user.id, email: user.email });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, email: user.email });
});

app.post('/documents', requireAuth, async (req, res) => {
  const { title } = req.body;
  const doc = await prisma.document.create({
    data: { title, ownerId: req.userId }
  });
  res.json(doc);
});

app.get('/documents', requireAuth, async (req, res) => {
  const docs = await prisma.document.findMany({
    where: { ownerId: req.userId }
  });
  res.json(docs);
});

app.get('/documents/:id', requireAuth, async (req, res) => {
  const doc = await prisma.document.findFirst({
    where: { id: Number(req.params.id), ownerId: req.userId }
  });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

app.put('/documents/:id', requireAuth, async (req, res) => {
  const { title, content } = req.body;
  const doc = await prisma.document.updateMany({
    where: { id: Number(req.params.id), ownerId: req.userId },
    data: { title, content }
  });
  if (doc.count === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

app.delete('/documents/:id', requireAuth, async (req, res) => {
  const doc = await prisma.document.deleteMany({
    where: { id: Number(req.params.id), ownerId: req.userId }
  });
  if (doc.count === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = { app, prisma, requireAuth };