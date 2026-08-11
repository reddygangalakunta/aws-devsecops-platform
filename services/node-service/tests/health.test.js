const request = require('supertest');
const app = require('../src/app');

describe('Node.js Health & Metrics Endpoints', () => {
  it('GET /health should return 200 and valid health payload', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('service');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('system');
    expect(res.body).toHaveProperty('dependencies');
  });

  it('GET /health/live should return 200 for Kubernetes livenessProbe', async () => {
    const res = await request(app).get('/health/live');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('alive');
  });

  it('GET /health/ready should return 200 for Kubernetes readinessProbe', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('ready');
  });

  it('GET /metrics should return Prometheus metrics format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('node_http_requests_total');
  });
});
