const API_BASE = process.env.QA_API_URL ?? 'http://localhost:3000';

/**
 * Check if backend is responding.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check if frontend is responding.
 */
export async function checkFrontendHealth(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:3001/', { signal: AbortSignal.timeout(5000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Get JWT token via POST /auth/login.
 */
export async function getToken(identificador: string, senha: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador, senha }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token ?? data.access_token;
}

/**
 * Make an authenticated GET request.
 */
export async function apiGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}
