import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const api = readFileSync('supabase/functions/ai-management-assistant/index.ts', 'utf8');
const client = readFileSync('src/lib/ai-assistant.ts', 'utf8');
const view = readFileSync('src/views/AICenter.tsx', 'utf8');

test('coach plans are separate from recorded training questions', () => {
  assert.match(api, /isNewTrainingPlan\(q,persona\)/);
  assert.match(api, /const history=\/\(/);
  assert.match(api, /const proposal=\/\(/);
  assert.match(api, /designingPlan\?2200:700/);
});

test('research is double opt-in and excludes internal data', () => {
  assert.match(api, /designingPlan&&b\.research===true/);
  assert.match(api, /Deno\.env\.get\("AI_WEB_GROUNDING_ENABLED"\)==="true"/);
  assert.match(api, /researchEnabled\?\{persona,question:q\}:\{persona,question:q,snapshot\}/);
  assert.match(api, /if\(researchEnabled\)requestBody\.tools=\[\{google_search:\{\}\}\]/);
});

test('search results return verifiable links and safe UI rendering', () => {
  assert.match(api, /groundingMetadata/);
  assert.match(api, /groundingChunks/);
  assert.match(api, /searchEntryPoint/);
  assert.match(client, /sources\?: AISource\[\]/);
  assert.match(view, /message\.sources\?\.map/);
  assert.match(view, /rel="noopener noreferrer"/);
  assert.match(view, /sandbox="allow-popups allow-popups-to-escape-sandbox"/);
});

test('authorization remains enforced', () => {
  assert.match(api, /sb\.auth\.getUser\(\)/);
  assert.match(api, /roles\[persona\]\.includes\(m\.role\)/);
});
