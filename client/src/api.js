async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Can't reach the server.");
  }

  if (res.status === 204) return null;
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

export function listItems() {
  return request('/items').then(data => data.items);
}

export function ingest(body) {
  return request('/ingest', { method: 'POST', body: JSON.stringify(body) }).then(data => data.item);
}

export function removeItem(id) {
  return request(`/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function ask(question) {
  return request('/query', { method: 'POST', body: JSON.stringify({ question }) });
}
