// Base URL for the backend API and a shared fetch helper.

const BASE_URL = 'http://localhost:3001/api';

/**
 * Call the API and get back parsed JSON.
 *
 * @param {string} path   - path after /api, e.g. '/vehicles' or '/vehicles/1'
 * @param {object} [options] - { method, body } - body is JSON-encoded automatically
 * @returns {Promise<any>} the parsed JSON response
 * @throws {Error} with the server's message when the response is not ok
 */
async function apiFetch(path, { method = 'GET', body } = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(BASE_URL + path, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  return data;
}
