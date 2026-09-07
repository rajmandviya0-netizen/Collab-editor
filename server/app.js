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
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/documents', requireAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const doc = await prisma.document.create({
      data: { title, ownerId: req.userId }
    });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Returns documents the user owns AND documents shared with them
app.get('/documents', requireAuth, async (req, res) => {
  try {
    const docs = await prisma.document.findMany({
      where: {
        OR: [
          { ownerId: req.userId },
          { sharedWith: { some: { userId: req.userId } } }
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Allows the owner OR anyone the document was shared with
app.get('/documents/:id', requireAuth, async (req, res) => {
  try {
    const doc = await prisma.document.findFirst({
      where: {
        id: Number(req.params.id),
        OR: [
          { ownerId: req.userId },
          { sharedWith: { some: { userId: req.userId } } }
        ]
      }
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Allows the owner OR anyone the document was shared with to edit
app.put('/documents/:id', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const doc = await prisma.document.updateMany({
      where: {
        id: Number(req.params.id),
        OR: [
          { ownerId: req.userId },
          { sharedWith: { some: { userId: req.userId } } }
        ]
      },
      data: { title, content }
    });
    if (doc.count === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Only the owner can delete
app.delete('/documents/:id', requireAuth, async (req, res) => {
  try {
    const doc = await prisma.document.deleteMany({
      where: { id: Number(req.params.id), ownerId: req.userId }
    });
    if (doc.count === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Only the owner can share their document with someone else
app.post('/documents/:id/share', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    const docId = Number(req.params.id);

    const doc = await prisma.document.findFirst({
      where: { id: docId, ownerId: req.userId }
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found or you are not the owner' });
    }

    const userToShareWith = await prisma.user.findUnique({ where: { email } });
    if (!userToShareWith) {
      return res.status(404).json({ error: 'No account found with that email' });
    }

    if (userToShareWith.id === req.userId) {
      return res.status(400).json({ error: 'You already own this document' });
    }

    await prisma.documentAccess.upsert({
      where: {
        documentId_userId: { documentId: docId, userId: userToShareWith.id }
      },
      update: {},
      create: { documentId: docId, userId: userToShareWith.id }
    });

    res.json({ success: true, sharedWith: email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = { app, prisma, requireAuth };