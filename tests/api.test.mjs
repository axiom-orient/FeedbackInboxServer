import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// This suite calls a real local Worker + D1, never a mocked DB or handler.
const base = process.env.FEEDBACK_TEST_URL;
test('private inbox admission, receipts and closure', { skip: !base }, async () => {
  const credential = () => ({ id: randomUUID(), secret: randomBytes(32).toString('hex'), appID: 'com.axionorient.sumday' });
  const a = credential(), b = credential();
  async function call(path, body, owner = a, headers = {}) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: {
      'Content-Type': 'application/json', 'Authorization': `Bearer ${owner.id}:${owner.secret}`, ...headers
    }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await call('/installations', a)).status, 201);
  assert.equal((await call('/installations', a)).status, 200);
  assert.equal((await call('/installations', { ...a, secret: b.secret })).status, 409);
  assert.equal((await call('/installations', b)).status, 201);
  const first = { id: randomUUID(), messageID: randomUUID(), body: '사진을 다시 열면 사라져요. <script>alert(1)</script>' };
  const receipt = await call('/threads', first);
  assert.equal(receipt.status, 201);
  assert.deepEqual((await call('/threads', first)).body, receipt.body);
  assert.equal((await call('/threads', { ...first, body: '다른 원문' })).status, 409);
  assert.equal((await call('/threads/' + first.id, undefined, b)).status, 404);
  assert.equal((await call('/threads', undefined, b)).body.threads.length, 0);
  assert.equal((await call('/threads/'+first.id+'/messages', { id: randomUUID(), body: '너무 빠른 답변' })).body.error, 'write_burst');
  await delay(2100);
  const reply = { id: randomUUID(), body: '세 장을 추가했어요.' };
  const second = await call('/threads/'+first.id+'/messages', reply);
  assert.equal(second.status, 201);
  assert.deepEqual((await call('/threads/'+first.id+'/messages', reply)).body, second.body);
  const detail = await call('/threads/' + first.id);
  assert.equal(detail.body.messages.length, 2);
  assert.equal(detail.body.messages[0].body, first.body);
  assert.equal((await call('/threads/'+first.id+'?after='+detail.body.messages[0].sequence)).body.messages.length, 1);
  const latest = (await call('/threads/'+first.id+'?latest=1')).body;
  assert.deepEqual(latest.messages, detail.body.messages);
  assert.equal(latest.previousBefore, null);
  assert.equal((await call('/threads/'+first.id+'?before='+latest.messages[1].sequence)).body.messages[0].id, first.messageID);
  assert.equal((await call('/threads/'+first.id+'?before=-1')).status, 400);
  const listed = (await call('/threads')).body.threads[0];
  assert.equal(listed.lastSender, 'user');
  assert.equal(listed.lastPreview, reply.body);
  assert.equal((await call('/threads/'+first.id+'/close', {})).status, 200);
  assert.equal((await call('/threads/'+first.id+'/messages', { id: randomUUID(), body: '닫힌 뒤 답변' })).body.error, 'thread_closed');
  // A receipt remains recoverable after closure.
  assert.deepEqual((await call('/threads/'+first.id+'/messages', reply)).body, second.body);
  assert.equal((await call('/threads', { id: randomUUID(), messageID: randomUUID(), body: 'x'.repeat(5001) })).status, 400);
  for (let i=0;i<2;i++) { await delay(2100); assert.equal((await call('/threads', { id: randomUUID(), messageID: randomUUID(), body: '새 문의 '+i })).status, 201); }
  const over = await call('/threads', { id: randomUUID(), messageID: randomUUID(), body: '네 번째 문의' });
  assert.equal(over.status, 429); assert.equal(over.body.error, 'daily_thread_limit');
  assert.equal((await call('/threads')).body.threads.length, 3);
  assert.equal((await call('/admin/threads', undefined, a, { 'Cf-Access-Authenticated-User-Email': 'operator@example.test' })).status, 403);
  assert.equal((await call('/admin')).status, 403);
  const oversized = await call('/threads', { body: 'x'.repeat(25000) });
  assert.equal(oversized.status, 413);
});
