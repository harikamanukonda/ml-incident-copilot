import { chat } from '../src/copilot.mjs';

const cases = [
  { incident: 'launch', message: 'Check feature drift', intent: 'drift', diagnosis: 'drift', citations: ['metrics/drift'] },
  { incident: 'pipeline', message: 'Show pipeline logs', intent: 'logs', diagnosis: 'pipeline', citations: ['logs/pipeline'] },
  { incident: 'relationship', message: 'Compare the candidate', intent: 'compare', diagnosis: 'relationship', citations: ['models/validation'] },
  { incident: 'healthy', message: 'What is the capital of France?', intent: 'clarify', diagnosis: 'healthy', citations: [] },
];

const demo = process.argv.includes('--simulate-regression');
let failures = 0;
for (const fixture of cases) {
  const result = chat(fixture);
  if (demo && fixture.incident === 'launch') {
    result.answer = result.answer.replace('[metrics/drift]', '');
  }
  const cited = [...result.answer.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]);
  const available = new Set(result.sources.map(source => source.id));
  const problems = [];
  if (result.intent !== fixture.intent) problems.push('unexpected routing');
  if (result.diagnosis.code !== fixture.diagnosis) problems.push('unexpected diagnosis');
  for (const id of fixture.citations) {
    if (!cited.includes(id)) problems.push('missing citation ' + id);
  }
  for (const id of cited) {
    if (!available.has(id)) problems.push('unknown citation ' + id);
  }
  if (problems.length) failures++;
  console.log([problems.length ? 'FAIL' : 'PASS', fixture.message, ...problems].join(' | '));
}
process.exitCode = failures ? 1 : 0;
