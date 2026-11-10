import {catalog} from '../src/scenarios.mjs';
import {chat, investigate} from '../src/copilot.mjs';
const byId = id => document.getElementById(id);
let incident = 'launch', history = [], busy = false, model = null, lastResult = null;
const suggestions = ['Why did model errors increase?', 'Check feature drift', 'Show pipeline logs', 'Compare the candidate'];
function element(tag, className, text) {const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;}
function drawMetrics(result) {
  const {quality, drift, validation} = result.evidence;
  byId('metrics').replaceChildren();
  for (const [title, value, sub, foot] of [
    ['Current prediction error', quality.current_mae.toFixed(3), 'MAE', `${quality.error_ratio.toFixed(1)}× reference error`],
    ['Feature distribution shift', drift.psi.toFixed(3), 'PSI', `Demo threshold ${drift.threshold}`],
    ['Candidate validation', validation.candidate_mae.toFixed(3), 'MAE', `${(validation.relative_improvement * 100).toFixed(1)}% relative improvement`],
    ['Validation partition', '400', 'rows', 'Separate from 600 training rows']
  ]) {
    const card = element('div', 'metric');
    const metric = element('div', 'metric-value', value); metric.append(element('span', 'metric-sub', sub));
    card.append(element('div', 'metric-title', title), metric, element('div', 'metric-foot', foot)); byId('metrics').append(card);
  }
  byId('hypothesis').textContent = result.diagnosis.summary;
  byId('confidence').textContent = result.diagnosis.confidence;
  byId('tool-trace').replaceChildren();
  for (const call of result.trace) {
    const item = element('div', 'tool'); const info = element('div'); info.append(element('code', '', call.tool), element('small', '', call.result.id));
    item.append(element('span', '', '✓'), info); byId('tool-trace').append(item);
  }
  byId('raw').textContent = JSON.stringify({sources: result.sources, tool_calls: result.trace}, null, 2);
}
function addMessage(role, text, result) {
  const row = element('article', `chat-message ${role}`), content = element('div', 'message-content');
  const label = element('div', 'message-label', role === 'user' ? 'You' : 'Incident Copilot');
  if (role !== 'user') label.append(element('small', '', 'EVIDENCE ENGINE'));
  content.append(label, element('div', 'message-text', text));
  if (result) {
    const chips = element('div', 'citation-links');
    for (const source of result.sources) {const chip = element('button', 'source-chip', source.id); chip.type = 'button'; chip.addEventListener('click', () => {document.querySelector('.raw').open = true; byId('raw').textContent = JSON.stringify(source, null, 2); byId('raw').scrollIntoView({behavior: 'smooth', block: 'center'});}); chips.append(chip);}
    content.append(chips);
    if (result.interpretation) {const panel = element('div', 'interpretation'); panel.append(element('strong', '', `LOCAL MODEL · ${result.interpretation.model} · UNVERIFIED INTERPRETATION`), document.createTextNode(result.interpretation.text)); content.append(panel);}
  }
  row.append(element('div', role === 'user' ? 'bot-avatar user-avatar' : 'bot-avatar', role === 'user' ? 'Y' : '⌘'), content);
  byId('chat').append(row);
}
function setBusy(value) {
  busy = value; byId('send').disabled = value; byId('message').disabled = value;
  document.querySelectorAll('.incident-button,.suggestions button,#mode').forEach(node => node.disabled = value);
}
function selectIncident(id) {
  if (busy) return;
  incident = id; history = []; byId('chat').replaceChildren(); byId('status').textContent = ''; byId('message').value = '';
  byId('incident-name').textContent = catalog.find(s => s.id === id).name;
  document.querySelectorAll('.incident-button').forEach(node => {node.classList.toggle('active', node.dataset.id === id); node.setAttribute('aria-pressed', String(node.dataset.id === id));});
  lastResult = chat({incident, message: 'Investigate this incident'}); drawMetrics(lastResult);
  addMessage('assistant', 'I’ve loaded the observation window and checked model quality, feature distributions, pipeline logs, and candidate validation. Ask me what changed—or inspect the evidence board.\n\nThis is a synthetic investigation. Evidence mode uses explicit diagnostic rules; optional local-model explanations are labeled separately.');
}
for (const item of catalog) {
  const button = element('button', 'incident-button', item.name); button.dataset.id = item.id; button.type = 'button'; button.append(element('span', '', item.subtitle)); button.addEventListener('click', () => selectIncident(item.id)); byId('incidents').append(button);
}
for (const text of suggestions) {const button = element('button', '', text); button.type = 'button'; button.addEventListener('click', () => {byId('message').value = text; byId('composer').requestSubmit();}); byId('suggestions').append(button);}
byId('composer').addEventListener('submit', async event => {
  event.preventDefault(); const message = byId('message').value.trim(); if (!message || busy) return;
  addMessage('user', message); byId('message').value = ''; setBusy(true); byId('status').textContent = 'Checking the evidence…';
  try {
    const input = {incident, message, history: history.slice(-20)};
    let result;
    if (byId('mode').value === 'ollama') {
      const response = await fetch(new URL('../api/chat', import.meta.url), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...input, mode: 'ollama'})});
      result = await response.json(); if (!response.ok) throw Error(result.error || 'Request failed');
    } else result = chat(input);
    history.push({role: 'user', content: message}, {role: 'assistant', content: result.answer});
    lastResult = result; addMessage('assistant', result.answer, result); drawMetrics(result); byId('status').textContent = 'Investigation updated. No actions performed.';
  } catch (error) {addMessage('assistant', error.message); byId('status').textContent = 'Request failed. You can retry in evidence mode.';}
  finally {setBusy(false); byId('message').focus();}
});
byId('message').addEventListener('keydown', event => {if (event.key === 'Enter' && !event.shiftKey) {event.preventDefault(); byId('composer').requestSubmit();}});
byId('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({incident, mode: byId('mode').value, conversation: history, last_result: lastResult, synthetic: true}, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob), link = element('a'); link.href = url; link.download = `incident-${incident}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
selectIncident(incident);
fetch(new URL('../api/config', import.meta.url)).then(response => response.ok ? response.json() : null).then(config => {if (config?.model) {model = config.model; const option = element('option', '', `Local: ${model}`); option.value = 'ollama'; byId('mode').append(option);}}).catch(() => {});
