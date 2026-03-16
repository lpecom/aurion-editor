const API_BASE = '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { retries?: number; timeout?: number },
): Promise<T> {
  const { retries = 1, timeout = 15000, ...fetchOptions } = options || {};

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...fetchOptions,
        headers: {
          ...(fetchOptions?.body != null ? { 'Content-Type': 'application/json' } : {}),
          ...fetchOptions?.headers,
        },
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 401) {
        if (!path.startsWith('/auth/')) {
          window.location.href = '/admin/login';
        }
        throw new ApiError('Unauthorized', 401);
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new ApiError(error.message || error.error || `HTTP ${res.status}`, res.status);
      }

      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on client errors (4xx) or abort
      if (err instanceof ApiError && err.status < 500) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Only throw abort error on the last attempt; otherwise retry
        if (attempt >= retries) {
          throw new ApiError('Tempo limite da requisição excedido', 408);
        }
      }

      // Retry with exponential backoff on server errors
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 5000)));
      }
    }
  }

  throw lastError || new Error('Request failed');
}

export const api = {
  get: <T>(path: string) => request<T>(path, { retries: 2 }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
