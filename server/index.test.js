const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, prisma } = require('./app');

describe('POST /signup', () => {
  it('creates a new user and returns id + email', async () => {
    const testEmail = `test-${Date.now()}@example.com`;

    const res = await request(app)
      .post('/signup')
      .send({ email: testEmail, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe(testEmail);
  });
});

describe('POST /login', () => {
  it('logs in with correct credentials and returns a token', async () => {
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = 'password123';

    await request(app).post('/signup').send({ email: testEmail, password: testPassword });

    const res = await request(app)
      .post('/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects login with wrong password', async () => {
    const testEmail = `login-test2-${Date.now()}@example.com`;

    await request(app).post('/signup').send({ email: testEmail, password: 'correctpassword' });

    const res = await request(app)
      .post('/login')
      .send({ email: testEmail, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});

describe('Document routes', () => {
  let token;
  let userEmail;

  // Sign up + log in a fresh user before these tests, so we have a valid token
  beforeAll(async () => {
    userEmail = `doc-test-${Date.now()}@example.com`;
    await request(app).post('/signup').send({ email: userEmail, password: 'password123' });

    const loginRes = await request(app)
      .post('/login')
      .send({ email: userEmail, password: 'password123' });

    token = loginRes.body.token;
  });

  it('creates a document when authenticated', async () => {
    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My First Doc' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('My First Doc');
  });

  it('lists only the logged-in user\'s documents', async () => {
    await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Second Doc' });

    const res = await request(app)
      .get('/documents')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('gets a single document by id', async () => {
    const createRes = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Doc To Fetch' });

    const res = await request(app)
      .get(`/documents/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Doc To Fetch');
  });

  it('updates a document', async () => {
    const createRes = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Doc To Update' });

    const res = await request(app)
      .put(`/documents/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title', content: 'Updated content' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/documents/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.body.title).toBe('Updated Title');
  });

  it('deletes a document', async () => {
    const createRes = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Doc To Delete' });

    const res = await request(app)
      .delete(`/documents/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/documents/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(404);
  });
});

describe('Document routes - auth failures', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/documents');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token', async () => {
    const res = await request(app)
      .get('/documents')
      .set('Authorization', 'Bearer invalidtoken123');

    expect(res.status).toBe(401);
  });

  it('prevents a user from accessing another user\'s document', async () => {
    // User A creates a doc
    const emailA = `userA-${Date.now()}@example.com`;
    await request(app).post('/signup').send({ email: emailA, password: 'password123' });
    const loginA = await request(app).post('/login').send({ email: emailA, password: 'password123' });
    const tokenA = loginA.body.token;

    const createRes = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'User A Private Doc' });

    // User B tries to access it
    const emailB = `userB-${Date.now()}@example.com`;
    await request(app).post('/signup').send({ email: emailB, password: 'password123' });
    const loginB = await request(app).post('/login').send({ email: emailB, password: 'password123' });
    const tokenB = loginB.body.token;

    const res = await request(app)
      .get(`/documents/${createRes.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});