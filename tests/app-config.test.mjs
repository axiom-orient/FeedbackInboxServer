import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {appConfig} from '../scripts/create-app-config.mjs';
test('per-app config uses supplied D1/Access without copying Sumday bindings',()=>{
 const input={workerName:'other-feedback',appID:'com.axionorient.other',appName:'다른 앱',databaseName:'other-feedback',databaseID:'11111111-2222-3333-4444-555555555555',accessTeamDomain:'team.cloudflareaccess.com',accessAudience:'a'.repeat(64),operatorEmail:'operator@example.test'};
 const config=appConfig(input,'/tmp/app-settings/wrangler.jsonc');
 assert.equal(config.vars.APP_ID,input.appID);assert.equal(config.vars.APP_NAME,input.appName);
 assert.equal(config.d1_databases[0].database_id,input.databaseID);assert.equal(config.vars.ACCESS_AUD,input.accessAudience);
 assert.equal(config.preview_urls,false);assert.equal(config.vars.AI_TRIAGE_ENABLED,'false');assert.equal(config.ai,undefined);
 assert.equal(resolve(dirname('/tmp/app-settings/wrangler.jsonc'),config.main),fileURLToPath(new URL('../src/worker.js',import.meta.url)));assert.throws(()=>appConfig({...input,databaseID:''},'/tmp/ignored'),/Complete/);
 assert.equal(appConfig({...input,appID:'a'.repeat(128)},'/tmp/valid').vars.APP_ID.length,128);
 for(const appID of ['ab','앱.example','com.example\n','a'.repeat(129)]) assert.throws(()=>appConfig({...input,appID},'/tmp/invalid'),/Complete/);
});
