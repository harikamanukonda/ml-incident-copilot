import { readFileSync } from 'node:fs';
import { chat } from '../src/copilot.mjs';

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));

const demo = process.argv.includes('--simulate-regression');
let failures = 0;
for (const fixture of cases) {
  const { incident, message, prior_question } = fixture;
  const history = [];
  if (prior_question) {
    const prior = chat({ incident, message: prior_question });
    history.push({ role: 'user', content: prior_question }, { role: 'assistant', content: prior.answer });
  }
  const result = chat({ incident, message, history });
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
  if (fixture.intent === 'clarify' && cited.length) problems.push('unexpected citation in clarification');
  if (result.action_performed) problems.push('unexpected action');
  if (problems.length) failures++;
  console.log([problems.length ? 'FAIL' : 'PASS', fixture.message, ...problems].join(' | '));
}
process.exitCode = failures ? 1 : 0;
