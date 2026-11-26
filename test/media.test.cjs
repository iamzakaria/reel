const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rangeFor,toVtt,remotePath}=require('../media.cjs');
test('byte ranges support seeking and suffix requests',()=>{assert.deepEqual(rangeFor('bytes=20-39',100),{start:20,end:39,partial:true});assert.deepEqual(rangeFor('bytes=-20',100),{start:80,end:99,partial:true});assert.equal(rangeFor('bytes=50-',100).end,99);assert.throws(()=>rangeFor('bytes=100-',100));assert.throws(()=>rangeFor('bytes=2-1',100));assert.throws(()=>rangeFor('bytes=0-1,4-5',100));});
test('subtitle conversion preserves cues and handles BOM',()=>{assert.equal(toVtt('\uFEFF1\n00:00:01,200 --> 00:00:04,000\nHello'),'WEBVTT\n\n1\n00:00:01.200 --> 00:00:04.000\nHello');assert.equal(toVtt('WEBVTT\n\n'),'WEBVTT\n\n');});
test('paths normalize and reject FTP command injection',()=>{assert.equal(remotePath('/Movies/../Series'),'/Series');assert.throws(()=>remotePath('/x\r\nDELE file'));});
