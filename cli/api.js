/**
 * HTTP client functions for the Synergy Prompt Crafter REST API.
 * Pure async functions — no side effects, easily testable via fetch mocking.
 */

/** @param {string} baseUrl @param {string} [search] */
export async function fetchPrompts(baseUrl, search) {
  const url = new URL(`${baseUrl}/api/prompts`);
  if (search) url.searchParams.set('search', search);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.json().catch(() => ({}))).error || res.statusText}`);
  return res.json();
}

/** @param {string} baseUrl @param {string} id */
export async function fetchPrompt(baseUrl, id) {
  const res = await fetch(`${baseUrl}/api/prompts/${id}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.json().catch(() => ({}))).error || res.statusText}`);
  return res.json();
}

/**
 * @param {string} baseUrl
 * @param {object} data
 */
export async function createPrompt(baseUrl, data) {
  const res = await fetch(`${baseUrl}/api/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.json().catch(() => ({}))).error || res.statusText}`);
  return res.json();
}

/** @param {string} baseUrl @param {string} id @param {object} changes */
export async function updatePrompt(baseUrl, id, changes) {
  const res = await fetch(`${baseUrl}/api/prompts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.json().catch(() => ({}))).error || res.statusText}`);
  return res.json();
}

/** @param {string} baseUrl @param {string} id */
export async function deletePrompt(baseUrl, id) {
  const res = await fetch(`${baseUrl}/api/prompts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.json().catch(() => ({}))).error || res.statusText}`);
}
