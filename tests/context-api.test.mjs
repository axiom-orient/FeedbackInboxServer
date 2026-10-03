import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.env.FEEDBACK_TEST_URL;
test('real Worker persists immutable context per message and rejects altered retries', { skip: !base }, async () => {
  const installation = {id:randomUUID(),secret:randomBytes(32).toString('hex'),appID:'com.axionorient.sumday'};
  async function call(path,input) {
    const r = await fetch(base+path,{method:input?'POST':'GET',headers:{'Content-Type':'application/json',
      Authorization:`Bearer ${installation.id}:${installation.secret}`},body:input?JSON.stringify(input):undefined});
    return {status:r.status,data:await r.json()};
  }
  assert.equal((await call('/installations',installation)).status,201);
  const context={schemaVersion:1,appName:'섬데이',appID:'com.axionorient.sumday',appVersion:'1.0',appBuild:'7',osName:'iOS',osVersion:'26.5',deviceModel:'iPhone',language:'ko-KR'};
  const first={id:randomUUID(),messageID:randomUUID(),body:'기본 정보 전달 검증용 문의입니다.',clientContext:context};
  const receipt=await call('/threads',first);
  assert.equal(receipt.status,201);assert.deepEqual(receipt.data.message.clientContext,context);
  assert.deepEqual((await call('/threads',first)).data,receipt.data);
  assert.equal((await call('/threads',{...first,clientContext:{...context,appVersion:'2.0'}})).status,409);
  assert.equal((await call('/threads',{id:randomUUID(),messageID:randomUUID(),body:'잘못된 정보',clientContext:{...context,email:'private@example.test'}})).status,400);
  await delay(2100);
  const reply={id:randomUUID(),body:'업데이트 후 답변을 보내는 검증용 문장입니다.',clientContext:{...context,appVersion:'2.0',appBuild:'8',osVersion:'27.0'}};
  const second=await call('/threads/'+first.id+'/messages',reply);
  assert.equal(second.status,201);assert.deepEqual(second.data.message.clientContext,reply.clientContext);
  assert.deepEqual((await call('/threads/'+first.id+'/messages',reply)).data,second.data);
  const page=(await call('/threads/'+first.id)).data;
  assert.deepEqual(page.messages.map(m=>m.clientContext),[context,reply.clientContext]);
  assert.equal(page.messages[0].body,first.body);
});
