export function rng(seed = 42) {
  let state = seed >>> 0;
  return () => {state = (Math.imul(1664525, state) + 1013904223) >>> 0; return (state + 1) / 4294967297;};
}
export function normal(random) {return Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());}
export const mean = values => values.reduce((sum, n) => sum + n, 0) / values.length;
export const mae = (actual, predicted) => mean(actual.map((value, i) => Math.abs(value - predicted[i])));
export function psi(reference, current) {
  if (!reference.length || !current.length || ![...reference, ...current].every(Number.isFinite)) throw Error('Finite nonempty samples required');
  const sorted = [...reference].sort((a, b) => a - b);
  const edges = [-Infinity, ...Array.from({length: 9}, (_, i) => sorted[Math.floor(sorted.length * (i + 1) / 10)]), Infinity];
  const histogram = values => {
    const counts = Array(10).fill(0);
    values.forEach(value => {let bin = edges.findIndex((edge, i) => i > 0 && value < edge) - 1; if (bin < 0) bin = 9; counts[bin]++;});
    return counts.map(n => Math.max(n / values.length, 1e-6));
  };
  const a = histogram(reference), b = histogram(current);
  return a.reduce((sum, expected, i) => sum + (b[i] - expected) * Math.log(b[i] / expected), 0);
}
export function linearFit(x, y) {
  const mx = mean(x), my = mean(y);
  const denominator = x.reduce((sum, value) => sum + (value - mx) ** 2, 0);
  const slope = x.reduce((sum, value, i) => sum + (value - mx) * (y[i] - my), 0) / denominator;
  return {slope, intercept: my - slope * mx};
}
export const predict = (model, x) => x.map(value => model.intercept + model.slope * value);
export const round = value => Math.round(value * 10000) / 10000;
