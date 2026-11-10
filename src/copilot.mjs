import {createScenario} from './scenarios.mjs';
import {callTool} from './tools.mjs';
export function diagnose(evidence) {
  const {quality, drift, logs, validation} = evidence;
  const pipelineWarning = logs.entries.some(e => e.level === 'WARN' && /defaulted.*zero/i.test(e.message));
  if (pipelineWarning && drift.zero_fraction > .1) return {code: 'pipeline', confidence: 'Strong supporting evidence', summary: 'An upstream feature-processing fault is the leading explanation.', uncertainty: 'The warning and zero-value spike align with the quality drop. A clean-data replay is still required to establish causation.', next: ['Verify the join key and transformer change.', 'Repair the feature pipeline and replay the same validation window.', 'Compare errors after repair before retraining.']};
  if (quality.error_ratio < 1.5 && drift.psi < .2) return {code: 'healthy', confidence: 'No strong incident signal', summary: 'The observed window does not show a material quality or monitored-feature shift.', uncertainty: 'This checks one synthetic feature and assumes immediate labels. Other slices or delayed failures could be missed.', next: ['Continue monitoring labeled quality and input integrity.', 'Check additional slices before escalating.', 'Keep the incumbent; no automatic change is justified.']};
  if (drift.psi > .2 && quality.error_ratio >= 1.5) return {code: 'drift', confidence: 'Plausible hypothesis', summary: 'A feature-distribution shift coincides with degraded forecast quality.', uncertainty: 'Correlation does not establish causation. The shift alone cannot explain the error; inspect residuals and changes in the target relationship.', next: ['Inspect new-product traffic and residuals by feature range.', 'Validate the target definition and feature transformations.', 'Evaluate the candidate on representative held-out labels.']};
  if (quality.error_ratio >= 1.5 && validation.relative_improvement > .05) return {code: 'relationship', confidence: 'Plausible hypothesis', summary: 'A changing target relationship is a plausible explanation despite stable monitored inputs.', uncertainty: 'This is consistent with concept drift, but label issues or unmonitored features remain alternatives.', next: ['Verify label quality and target definitions.', 'Compare prediction residuals across time and product slices.', 'Gather an independent validation window before any promotion.']};
  return {code: 'unknown', confidence: 'Insufficient evidence', summary: 'The available evidence does not isolate a likely cause.', uncertainty: 'More monitoring slices and pipeline history are needed.', next: ['Collect feature-quality checks and additional labeled windows.']};
}
export function investigate(id) {
  const scenario = createScenario(id), trace = [];
  const evidence = {quality: callTool('inspect_metrics', scenario, null, trace), drift: callTool('calculate_drift', scenario, null, trace), logs: callTool('query_logs', scenario, null, trace), validation: callTool('compare_models', scenario, null, trace)};
  const diagnosis = diagnose(evidence);
  const runbook = callTool('read_runbook', scenario, diagnosis.code === 'unknown' ? 'healthy' : diagnosis.code, trace);
  return {scenario, evidence, diagnosis, runbook, trace};
}
export function chat({incident = 'launch', message, history = []}) {
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw Error('Message must contain 1–2,000 characters');
  if (!Array.isArray(history) || history.length > 20 || history.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 10000)) throw Error('Invalid conversation history');
  const result = investigate(incident);
  const {evidence: e, diagnosis: d, runbook, trace} = result;
  const question = message.toLowerCase();
  let intent = 'investigate', answer;
  if (/\b(promote|deploy|rollback|roll back|approve|replace|switch)\b/.test(question)) {
    intent = 'action';
    answer = `No deployment or model change was performed. This copilot has read-only tools.\n\nThe candidate ${e.validation.quality_gate_passed ? 'passes' : 'does not pass'} the demo quality gate: held-out MAE ${e.validation.candidate_mae} versus ${e.validation.incumbent_mae} for the incumbent [models/validation]. ${d.code === 'pipeline' ? 'Repair and replay the feature pipeline first [logs/pipeline]. ' : ''}A quality gate is not deployment approval. Use a separately authorized deployment workflow after independent validation.`;
  } else if (/\b(compare|candidate|retrain|validation|gate)\b/.test(question)) {
    intent = 'compare';
    answer = `On ${e.validation.validation_rows} held-out rows, incumbent MAE is ${e.validation.incumbent_mae} and candidate MAE is ${e.validation.candidate_mae}. The candidate was fitted on a separate ${e.validation.training_rows}-row partition. Relative improvement is ${(e.validation.relative_improvement * 100).toFixed(1)}%; the demo gate requires 5% [models/validation].\n\n${d.code === 'pipeline' ? 'Fix the upstream feature fault before interpreting retraining as a solution [logs/pipeline].' : d.uncertainty}\n\nNo model was promoted.`;
  } else if (/\b(log|logs|pipeline|join|transformer)\b/.test(question)) {
    intent = 'logs'; answer = e.logs.entries.map(log => `${log.at} ${log.level}: ${log.message}`).join('\n') + '\n\nThese synthetic logs contain no deployment change. Correlate them with the model-quality window [logs/pipeline].';
  } else if (/\b(drift|psi|distribution)\b/.test(question)) {
    intent = 'drift'; answer = `The monitored feature PSI is ${e.drift.psi}, versus a demo flag threshold of ${e.drift.threshold}. Its mean changed from ${e.drift.reference_mean} to ${e.drift.current_mean}; ${(e.drift.zero_fraction * 100).toFixed(1)}% of current values are exactly zero [metrics/drift].\n\nPSI measures distribution change, not model quality or causation. ${d.uncertainty}`;
  } else if (/\b(next|fix|recommend|should|steps|do that|what now)\b/.test(question)) {
    intent = 'next'; answer = `${d.summary}\n\n${d.next.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nRunbook: ${runbook.text} [${runbook.id}]`;
  } else if (/\b(why|investigate|happen|cause|health|error|wrong|evidence|explain|check|summari[sz]e)\b/.test(question) || /\b(it|that|more)\b/.test(question) && history.length) {
    answer = `${d.summary}\n\nReference MAE: ${e.quality.reference_mae}; current MAE: ${e.quality.current_mae} (${e.quality.error_ratio}×) [metrics/quality]. Feature PSI: ${e.drift.psi} [metrics/drift].\n\n${d.uncertainty}\n\nRecommended first check: ${d.next[0]} [${runbook.id}]`;
  } else {
    intent = 'clarify'; answer = 'I can investigate the selected incident, inspect feature drift and pipeline logs, compare candidate models, or suggest diagnostic steps. What would you like to check? I do not have evidence for unrelated questions.';
  }
  return {answer, intent, incident, mode: 'evidence', diagnosis: d, evidence: e, sources: [...Object.values(e), runbook], trace, history_used: history.length, action_performed: false};
}
