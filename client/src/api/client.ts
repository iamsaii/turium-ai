import type { Item, IngestRequestDTO, QueryResponseDTO } from '../types.js';

const BASE_URL = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data && data.error) {
          message = data.error;
        }
      } catch {
        if (text && text.trim().length > 0 && text.length < 300) {
          message = text.trim();
        }
      }
    } catch {
      // Body reading failed
    }
    throw new Error(message);
  }

  // Handle empty responses
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return {} as T;
}

export async function ingestItem(dto: IngestRequestDTO): Promise<Item> {
  const res = await fetch(`${BASE_URL}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dto),
  });
  return handleResponse<Item>(res);
}

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${BASE_URL}/items`);
  return handleResponse<Item[]>(res);
}

export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/items/${id}`, {
    method: 'DELETE',
  });
  await handleResponse<{ success: boolean }>(res);
}

export async function submitQuery(question: string): Promise<QueryResponseDTO> {
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });
  return handleResponse<QueryResponseDTO>(res);
}

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  const res = await fetch(`${BASE_URL}/health`);
  return handleResponse<{ status: string; timestamp: string }>(res);
}
