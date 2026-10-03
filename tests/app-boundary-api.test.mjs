import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
const base=process.env.FEEDBACK_TEST_URL;
test('real Worker binds registrations to its app and rejects mismatched message context', {skip:!base}, async()=>{
 const installation={id:randomUUID(),secret:randomBytes(32).toString('hex'),appID:'com.axionorient.sumday'};
 async function call(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${installation.id}:${installation.secret}`},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
 assert.equal((await call('/installations',{id:installation.id,secret:installation.secret})).body.error,'app_not_supported');
 assert.equal((await call('/installations',{...installation,appID:'com.axionorient.other'})).body.error,'app_not_supported');
 assert.equal((await call('/installations',installation)).status,201);
 assert.equal((await call('/installations',installation)).status,200);
 const first={id:randomUUID(),messageID:randomUUID(),body:'앱 경계 확인',clientContext:{schemaVersion:1,appID:'com.axionorient.other',appVersion:'1.0'}};
 assert.equal((await call('/threads',first)).body.error,'app_context_mismatch');
 assert.equal((await call('/threads')).body.threads.length,0);
 const receipt=await call('/threads',{...first,clientContext:{...first.clientContext,appID:installation.appID}});
 assert.equal(receipt.status,201);
 assert.equal((await call('/threads/'+first.id+'?latest=1')).body.messages.length,1);
 assert.equal((await call('/admin/settings')).status,403);
});
