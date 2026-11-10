import {rng, normal, linearFit} from './metrics.mjs';
export const catalog = [
  {id: 'launch', name: 'After the product launch', subtitle: 'Forecast error increased after a traffic change', severity: 'Investigate'},
  {id: 'pipeline', name: 'After the data refresh', subtitle: 'A scheduled pipeline completed with warnings', severity: 'Investigate'},
  {id: 'relationship', name: 'After the pricing update', subtitle: 'Input distributions look stable, but errors increased', severity: 'Investigate'},
  {id: 'healthy', name: 'Routine health check', subtitle: 'Check whether action is warranted', severity: 'Monitor'}
];
export function createScenario(id) {
  if (!catalog.some(s => s.id === id)) throw new Error('Unknown incident');
  const random = rng(42);
  const referenceX = Array.from({length: 1000}, () => normal(random));
  const referenceY = referenceX.map(x => 20 + 3 * x + normal(random) * .5);
  const rawX = Array.from({length: 1000}, () => normal(random) + (id === 'launch' ? 1.8 : 0));
  const currentY = rawX.map(x => 20 + (id === 'relationship' ? 5 : 3) * x + (id === 'launch' ? 1.8 * Math.max(0, x - 1) : 0) + normal(random) * .5);
  const observedX = rawX.map((x, i) => id === 'pipeline' && i % 3 === 0 ? 0 : x);
  const incumbent = linearFit(referenceX, referenceY);
  const candidate = linearFit(observedX.slice(0, 600), currentY.slice(0, 600));
  const logs = [
    {at: '09:00', level: 'INFO', message: 'Reference and current windows contain 1,000 labeled observations each.'},
    {at: '09:05', level: id === 'pipeline' ? 'WARN' : 'INFO', message: id === 'pipeline' ? 'Transformer v2.4: failed feature joins defaulted 334 rows to zero.' : 'Feature joins completed without default-value warnings.'},
    {at: '09:10', level: 'INFO', message: 'Incumbent serving version v1.8; no model deployment during the observation window.'}
  ];
  return {id, referenceX, referenceY, observedX, currentY, incumbent, candidate, logs, candidateTrain: 600, validation: 400};
}
