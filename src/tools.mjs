import {mae, psi, predict, mean, round} from './metrics.mjs';
const runbooks = {
  pipeline: {id: 'runbook/pipeline', title: 'Feature integrity', text: 'If feature joins default values unexpectedly, verify the join key and transformer version. Repair the upstream pipeline and replay validation data before considering retraining.'},
  drift: {id: 'runbook/drift', title: 'Distribution shift', text: 'Compare feature distributions and labeled model quality. PSI above 0.2 is a demo heuristic. Drift is an association, not proof of causation. Validate candidate models on disjoint labeled data.'},
  relationship: {id: 'runbook/relationship', title: 'Changing target relationship', text: 'Stable monitored inputs do not rule out concept drift. Investigate residuals, target definitions, and unmonitored features. A candidate improvement is supporting evidence, not causal proof.'},
  healthy: {id: 'runbook/healthy', title: 'Routine monitoring', text: 'If labeled quality and monitored features are stable, continue monitoring. Do not retrain or promote solely because an alert was requested.'}
};
export const tools = {
  inspect_metrics(s) {
    const baseline = mae(s.referenceY, predict(s.incumbent, s.referenceX));
    const current = mae(s.currentY, predict(s.incumbent, s.observedX));
    return {id: 'metrics/quality', title: 'Labeled model quality', reference_mae: round(baseline), current_mae: round(current), error_ratio: round(current / baseline), unit: 'synthetic target units', labels_available: true};
  },
  calculate_drift(s) {
    return {id: 'metrics/drift', title: 'Monitored feature distribution', feature: 'feature_0', psi: round(psi(s.referenceX, s.observedX)), reference_mean: round(mean(s.referenceX)), current_mean: round(mean(s.observedX)), zero_fraction: round(s.observedX.filter(x => x === 0).length / s.observedX.length), threshold: .2};
  },
  query_logs(s) {return {id: 'logs/pipeline', title: 'Pipeline and deployment logs', entries: s.logs};},
  compare_models(s) {
    const x = s.observedX.slice(s.candidateTrain), y = s.currentY.slice(s.candidateTrain);
    const incumbent = mae(y, predict(s.incumbent, x)), candidate = mae(y, predict(s.candidate, x));
    const improvement = (incumbent - candidate) / incumbent;
    return {id: 'models/validation', title: 'Disjoint candidate validation', incumbent: 'v1.8', candidate: 'candidate-local', training_rows: s.candidateTrain, validation_rows: s.validation, incumbent_mae: round(incumbent), candidate_mae: round(candidate), relative_improvement: round(improvement), minimum_improvement: .05, quality_gate_passed: improvement >= .05, persisted: false};
  },
  read_runbook(_s, key) {return runbooks[key];}
};
export function callTool(name, scenario, argument, trace) {
  if (!Object.hasOwn(tools, name)) throw Error('Tool not allowed');
  const result = tools[name](scenario, argument);
  trace.push({tool: name, argument: argument ?? null, result});
  return result;
}
