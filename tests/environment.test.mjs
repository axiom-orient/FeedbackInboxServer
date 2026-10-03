import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { environmentFilter, supportSettings } from '../src/support-query.js';

test('release and OS filters match the same original message, including unknown metadata', async () => {
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 db.exec("INSERT INTO installations(id,secret_hash,app_id) VALUES ('a','hash','com.axionorient.sumday'); INSERT INTO installations(id,secret_hash,app_id) VALUES ('b','hash','com.axionorient.other'); INSERT INTO threads(id,installation_id) VALUES ('t','a'); INSERT INTO threads(id,installation_id) VALUES ('unknown','a'); INSERT INTO threads(id,installation_id) VALUES ('other','b')");
 assert.throws(()=>db.exec("UPDATE installations SET app_id='com.axionorient.other' WHERE id='a'"),/installation_app_immutable/);
 const insert=db.prepare("INSERT INTO messages(id,thread_id,sender,body,client_context) VALUES (?,?,'user','원문',?)");
 const contexts=[{appVersion:'1.0',appBuild:'1',osName:'iOS',osVersion:'26.5'},{appVersion:'2.0',appBuild:'2',osName:'iOS',osVersion:'27.0'}];
 for(let n=0;n<2;n++){db.exec('UPDATE installations SET last_write_at=NULL');insert.run('m'+n,'t',JSON.stringify(contexts[n]));}
 db.exec('UPDATE installations SET last_write_at=NULL');insert.run('old','unknown',null);insert.run('different-app','other',JSON.stringify({appVersion:'99',appBuild:'99',osName:'Android',osVersion:'99'}));
 function matches(params){const f=environmentFilter(new URL('https://example.test/admin/threads?'+params));return db.prepare(`SELECT t.id FROM threads t JOIN installations i ON i.id=t.installation_id WHERE i.app_id=? AND ${f.clause||'1'} ORDER BY t.id`).all('com.axionorient.sumday',...f.args).map(r=>r.id);}
 assert.deepEqual(matches('appVersion=1.0&appBuild=1&osName=iOS&osVersion=26.5'),['t']);
 assert.deepEqual(matches('appVersion=2.0&osVersion=27.0'),['t']);
 assert.deepEqual(matches('appVersion=1.0&osVersion=27.0'),[]);
 assert.deepEqual(matches('appVersion=&appBuild='),['unknown']);
 assert.deepEqual(matches('appVersion='+encodeURIComponent("1.0' OR 1=1 --")),[]);
 assert.throws(()=>environmentFilter(new URL('https://example.test/?appVersion='+encodeURIComponent('x\n'))),/invalid_filter/);
 // Real SQLite with the production queries; this adapter does not prove Cloudflare runtime.
 const adapter={prepare:sql=>({bind:(...args)=>({all:async()=>({results:db.prepare(sql).all(...args)})})})};
 const settings=await supportSettings(adapter,{id:'com.axionorient.sumday',name:'Sumday'});
 assert.equal(settings.releases.length,3);assert.ok(!settings.releases.some(r=>r.version==='99'));
 assert.equal(settings.systems.length,3);assert.ok(!settings.systems.some(r=>r.name==='Android'));
 db.close();
});
