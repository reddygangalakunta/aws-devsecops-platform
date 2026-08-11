const request = require('supertest');
const app = require('../src/app');

describe('Node.js Event Ingestion API', () => {
  it('POST /api/v1/events should reject invalid payloads', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .send({ user_id: 'anonymous' });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/v1/events should accept valid payload and handle downstream gracefully', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .send({
        event_type: 'api_access',
        source_ip: '192.168.1.50',
        user_id: 'user_1',
        payload: { path: '/api/v1/users', method: 'GET' },
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('analysis');
    expect(res.body.analysis).toHaveProperty('risk_score');
  });

  it('GET /api/v1/events should return history array', async () => {
    const res = await request(app).get('/api/v1/events');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('GET /api/v1/stats should return aggregate stats', async () => {
    const res = await request(app).get('/api/v1/stats');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('stats');
    expect(res.body.stats).toHaveProperty('totalProcessed');
  });
});
