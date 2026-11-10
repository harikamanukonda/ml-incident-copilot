import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {makeServer} from '../server.mjs';
import {interpretWithOllama} from '../src/llm.mjs';
import {chat} from '../src/copilot.mjs';
test('HTTP API serves chat and rejects bad requests', async () => {
  const server = makeServer({model:null}); server.listen(0,'127.0.0.1'); await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base+'/')).status,200);
    let response=await fetch(base+'/api/chat',{method:'POST',body:JSON.stringify({message:'Investigate why errors increased'})});
    assert.equal(response.status,200);assert.equal((await response.json()).action_performed,false);
    for (const body of ['[]','invalid',JSON.stringify({message:''})]) assert.equal((await fetch(base+'/api/chat',{method:'POST',body})).status,400);
    assert.equal((await fetch(base+'/api/chat',{method:'POST',headers:{Origin:'https://other.invalid'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/chat',{method:'POST',body:JSON.stringify({message:'hello',mode:'ollama'})})).status,503);
    assert.equal((await fetch(base+'/.git/config')).status,404);
  } finally {server.close();await once(server,'close');}
});
test('local model adapter passes evidence and bounds generation', async () => {
  let request;
  const result = await interpretWithOllama({result:chat({message:'Investigate'}), message:'What changed?', model:'test-fixture', fetcher:async (url, options) => {request=JSON.parse(options.body);return {ok:true,json:async()=>({message:{content:'Fixture interpretation'},eval_count:12})};}});
  assert.equal(request.stream,false);assert.equal(request.options.num_predict,320);
  assert.match(request.messages[0].content,/untrusted/);assert.equal(result.groundedness_verified,false);
});
test('local model adapter rejects malformed output', async () => {
  await assert.rejects(interpretWithOllama({result:chat({message:'Investigate'}),message:'Explain',model:'fixture',fetcher:async()=>({ok:true,json:async()=>({message:{content:42}})})}));
});
