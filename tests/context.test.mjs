import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeClientContext } from '../src/client-context.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const context = { schemaVersion: 1, appName: '섬데이', appID: 'com.axionorient.sumday',
  appVersion: '1.0', appBuild: '7', osName: 'iOS', osVersion: '26.5', deviceModel: 'iPhone', language: 'ko-KR' };
test('context is bounded, canonical and contains only support fields', () => {
  assert.equal(encodeClientContext(undefined), null);
  assert.deepEqual(JSON.parse(encodeClientContext(context)), context);
  assert.equal(encodeClientContext(Object.fromEntries(Object.entries(context).reverse())), encodeClientContext(context));
  for (const invalid of [[], {...context, schemaVersion: 2}, {...context, appVersion: 7}, {...context, email: 'private@example.test'},
    {...context, constructor: 'not a support field'}, {...context, appName: 'x'.repeat(129)}, {...context, deviceModel: 'bad\nvalue'}]) {
    assert.throws(()=>encodeClientContext(invalid), /invalid_client_context/);
  }
});
test('current schema keeps absent context unknown and rejects invalid stored JSON', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  db.exec("INSERT INTO installations(id,secret_hash,app_id) VALUES ('a','hash','com.axionorient.sumday'); INSERT INTO threads(id,installation_id) VALUES ('t','a'); INSERT INTO messages(id,thread_id,sender,body) VALUES ('m','t','operator','원문')");
  assert.equal(db.prepare('SELECT client_context FROM messages').get().client_context,null);
  assert.throws(()=>db.exec("UPDATE messages SET client_context='broken json'"),/CHECK constraint/);
  assert.throws(()=>db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8')),/already exists/);
  db.close();
});
