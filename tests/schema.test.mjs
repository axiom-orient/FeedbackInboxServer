import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

test('real SQLite transaction rollback, unlimited replies, block and read-only closed state', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  db.prepare("INSERT INTO installations(id,secret_hash,app_id) VALUES ('a','hash','com.axionorient.sumday')").run();
  db.prepare("INSERT INTO threads(id,installation_id) VALUES ('t','a')").run();
  const message = db.prepare("INSERT INTO messages(id,thread_id,sender,body) VALUES (?,'t','user','원문')");
  for(let i=0;i<25;i++) {
    db.exec('UPDATE installations SET last_write_at=NULL'); message.run('m'+i);
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,25);
  db.exec('UPDATE installations SET blocked_at=unixepoch()');
  assert.throws(()=>message.run('blocked'),/installation_blocked/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,25);
  db.exec("UPDATE threads SET status='closed'");
  assert.throws(()=>db.exec("INSERT INTO messages(id,thread_id,sender,body) VALUES ('operator','t','operator','답변')"),/thread_closed/);
  db.exec('UPDATE installations SET blocked_at=NULL');
  db.exec('BEGIN');
  try {
    db.exec("INSERT INTO threads(id,installation_id) VALUES ('partial','a')");
    db.exec("INSERT INTO messages(id,thread_id,sender,body) VALUES ('bad','partial','user','')");
    assert.fail('must reject invalid first message');
  } catch { db.exec('ROLLBACK'); }
  assert.equal(db.prepare("SELECT count(*) AS n FROM threads WHERE id='partial'").get().n,0);
  db.close();
});
