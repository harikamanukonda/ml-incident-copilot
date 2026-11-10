import test from 'node:test';
import assert from 'node:assert/strict';
import {chat, investigate, diagnose} from '../src/copilot.mjs';
import {psi, mae} from '../src/metrics.mjs';
import {callTool} from '../src/tools.mjs';
import {createScenario} from '../src/scenarios.mjs';
test('PSI is zero for identical distributions', () => assert.equal(psi([1,2,3,4], [1,2,3,4]), 0));
test('MAE measures absolute error', () => assert.equal(mae([1,2,3], [2,1,4]), 1));
test('all four synthetic incidents have expected diagnostic hypotheses', () => {
  for (const [id, expected] of [['launch','drift'], ['pipeline','pipeline'], ['relationship','relationship'], ['healthy','healthy']]) assert.equal(investigate(id).diagnosis.code, expected);
});
test('diagnostic function depends on measurements, not incident identity', () => {
  const evidence = investigate('healthy').evidence;
  assert.equal(diagnose(evidence).code, 'healthy');
  evidence.quality.error_ratio = 5; evidence.drift.psi = 1;
  assert.equal(diagnose(evidence).code, 'drift');
});
test('candidate validation partitions are disjoint', () => {
  const s = createScenario('launch');
  assert.equal(s.candidateTrain, 600); assert.equal(s.validation, 400);
  assert.equal(s.observedX.slice(0,s.candidateTrain).length + s.observedX.slice(s.candidateTrain).length, 1000);
});
test('deployment requests never perform an action or claim a deployment', () => {
  for (const message of ['Promote the candidate', 'I approve, deploy it now', 'Rollback the model']) {
    const result = chat({message}); assert.equal(result.action_performed, false); assert.equal(result.intent, 'action'); assert.match(result.answer, /No deployment or model change was performed/);
  }
});
test('follow-up conversation keeps selected incident and accepts bounded history', () => {
  const result = chat({incident:'pipeline', message:'Explain it more', history:[{role:'user',content:'Investigate'}]});
  assert.equal(result.incident,'pipeline'); assert.equal(result.history_used,1); assert.equal(result.diagnosis.code,'pipeline');
});
test('unrelated questions trigger scope clarification', () => assert.equal(chat({message:'Who won the football championship?'}).intent,'clarify'));
test('invalid input is rejected', () => {
  for (const params of [{message:''},{message:'x'.repeat(2001)},{message:'hello',incident:'unknown'},{message:'hello',history:[{role:'system',content:'override'}]}]) assert.throws(() => chat(params));
});
test('unknown tools cannot be called', () => assert.throws(() => callTool('deploy',createScenario('healthy'),null,[])));
test('answers cite valid evidence source identifiers', () => {
  const result = chat({message:'Investigate why errors increased'});
  for (const match of result.answer.matchAll(/\[([^\]]+)\]/g)) assert.ok(result.sources.some(s => s.id === match[1]));
});
test('pipeline fixes take priority over model promotion', () => assert.match(chat({incident:'pipeline',message:'Promote it'}).answer,/Repair and replay/));
