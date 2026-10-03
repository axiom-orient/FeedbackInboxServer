import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeOperator } from '../src/access.js';

test('Access origin authorization validates real signature, issuer, audience, expiry and exact email', async () => {
  const pair = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk = await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
  const env={ACCESS_TEAM_DOMAIN:'sumday-test.cloudflareaccess.com',ACCESS_AUD:'aud',OPERATOR_EMAIL:'operator@example.test'};
  const originalFetch=globalThis.fetch;
  // Only the key distribution endpoint is a fixture. Signature verification is real WebCrypto.
  globalThis.fetch=async url=>{assert.equal(url,'https://sumday-test.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const valid={iss:'https://sumday-test.cloudflareaccess.com',aud:['aud'],exp:Date.now()/1000+60,email:'operator@example.test'};
  async function request(payload=valid,corrupt=false){
    const unsigned=encode({alg:'RS256',kid:'test-key'})+'.'+encode(payload);
    const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(unsigned)));
    if(corrupt)signature[0]^=255;
    return new Request('https://feedback.example.test/admin/threads',{headers:{'Cf-Access-Jwt-Assertion':unsigned+'.'+Buffer.from(signature).toString('base64url')}});
  }
  try {
    assert.equal(await authorizeOperator(await request(),env),true);
    for(const invalid of [{...valid,iss:'https://evil.example.test'},{...valid,aud:['other']},{...valid,exp:0},{...valid,email:'other@example.test'},{...valid,nbf:Date.now()/1000+300}])assert.equal(await authorizeOperator(await request(invalid),env),false);
    assert.equal(await authorizeOperator(await request(valid,true),env),false);
    assert.equal(await authorizeOperator(new Request('https://feedback.example.test/admin',{headers:{'Cf-Access-Authenticated-User-Email':valid.email}}),env),false);
    assert.equal(await authorizeOperator(await request(),{...env,ACCESS_AUD:''}),false);
  }finally{globalThis.fetch=originalFetch;}
});
