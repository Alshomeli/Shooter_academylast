import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const api = readFileSync('supabase/functions/ai-management-assistant/index.ts', 'utf8');
const client = readFileSync('src/lib/ai-assistant.ts', 'utf8');
const view = readFileSync('src/views/AICenter.tsx', 'utf8');

test('new coaching plans remain separate from recorded sessions', () => {
  assert.match(api, /isNewTrainingPlan\(q,persona\)/);
  assert.match(api, /const history=\/\(/);
  assert.match(api, /const proposal=\/\(/);
  assert.match(api, /designingPlan\?2200:700/);
});

test('Tavily is a double opt-in and receives sanitized public searches only', () => {
  assert.match(api, /designingPlan&&b\.research===true/);
  assert.match(api, /AI_TAVILY_SEARCH_ENABLED/);
  assert.match(api, /TAVILY_API_KEY/);
  assert.match(api, /safeCoachingQuery\(question\)/);
  assert.match(api, /api\.tavily\.com\/search/);
  assert.match(api, /search_depth:"basic"/);
  assert.match(api, /max_results:4/);
  assert.match(api, /researchRequested\?\{persona,question:q,publicSources:/);
  assert.doesNotMatch(api, /google_search/);
});

test('sources are surfaced as external links; errors do not claim live research', () => {
  assert.match(api, /const sources=publicSources/);
  assert.match(api, /did not|لم يتم البحث/);
  assert.match(client, /sources\?: AISource\[\]/);
  assert.match(view, /message\.sources\?\.map/);
  assert.match(view, /rel="noopener noreferrer"/);
});

test('authentication and role checks remain enforced', () => {
  assert.match(api, /sb\.auth\.getUser\(\)/);
  assert.match(api, /roles\[persona\]\.includes\(m\.role\)/);
});
