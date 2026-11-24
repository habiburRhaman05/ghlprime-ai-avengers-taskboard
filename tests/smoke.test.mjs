import assert from 'node:assert/strict';
import test from 'node:test';

const base = new URL(process.env.PORTAL_SMOKE_URL ?? 'http://localhost:3000');
const request = (path, init) => fetch(new URL(path, base), { redirect: 'manual', ...init });

test('the sign-in route renders and requests private caching', async () => {
  const response = await request('/login');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const html = await response.text();
  assert.match(html, /<h1>Welcome back/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="password"/);
});
test('anonymous users are redirected from protected routes', async () => {
  for (const route of ['/dashboard', '/tasks/new', '/settings', '/tasks/00000000-0000-4000-8000-000000000001']) {
    const response = await request(route);
    assert.equal(response.status, 307, route);
    assert.equal(new URL(response.headers.get('location'), base).pathname, '/login', route);
  }
});
test('media endpoints reject anonymous access and a mismatched origin', async () => {
  assert.equal((await request('/api/media/00000000-0000-4000-8000-000000000001')).status, 404);
  assert.equal((await request('/api/media', { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await request('/api/media', { method: 'POST', headers: { Origin: base.origin } })).status, 401);
});
