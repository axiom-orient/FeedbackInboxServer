import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {randomInt} from 'node:crypto';

// Generates configuration only. No API credentials, D1 creation or deployment.
export function appConfig(input, output) {
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!/^[a-z][a-z0-9-]{1,62}$/.test(input.workerName||'')
    || !/^[A-Za-z0-9][A-Za-z0-9.-]{2,127}$/.test(input.appID||'')
    || typeof input.appName!=='string' || !input.appName.trim() || input.appName.length>80
    || !/^[a-z][a-z0-9-]{1,62}$/.test(input.databaseName||'') || !uuid.test(input.databaseID||'')
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(input.accessTeamDomain||'')
    || !/^[0-9a-f]{64}$/.test(input.accessAudience||'')
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.operatorEmail||'')) throw new Error('Complete the app, separate D1 and Access settings before generating configuration.');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const config={name:input.workerName,main:relative(dirname(resolve(output)),resolve(root,'src/worker.js')),
  compatibility_date:'2026-10-02',workers_dev:true,preview_urls:false,
  rules:[{type:'Text',globs:['**/*.html'],fallthrough:true}],
  d1_databases:[{binding:'DB',database_name:input.databaseName,database_id:input.databaseID}],
  ratelimits:[{name:'REGISTRATION_LIMIT',namespace_id:String(randomInt(1002,2147483647)),simple:{limit:10,period:60}}],
  vars:{APP_ID:input.appID,APP_NAME:input.appName,ACCESS_TEAM_DOMAIN:input.accessTeamDomain,ACCESS_AUD:input.accessAudience,OPERATOR_EMAIL:input.operatorEmail,AI_TRIAGE_ENABLED:input.aiTriage===true?'true':'false'},
  observability:{enabled:false}};
 if(input.aiTriage===true)config.ai={binding:'AI'};
 return config;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'}}});
  if(!values.input||!values.output)throw new Error('Usage: node scripts/create-app-config.mjs --input app-settings.json --output /absolute/path/wrangler.jsonc');
  const config=appConfig(JSON.parse(await readFile(values.input,'utf8')),values.output);
  await writeFile(values.output,JSON.stringify(config,null,2)+'\n',{flag:'wx'});
  console.log('Created configuration. Initialize a new empty D1 from schema.sql and deploy only to the named app.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
