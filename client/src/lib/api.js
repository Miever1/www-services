// client/src/lib/api.js
import { apiUrl } from '$lib/api-config.js';

// GET 请求，自动带上 cookie
export async function apiGet(path) {
  const res = await fetch(apiUrl(path), {
    method: 'GET',
    credentials: 'include',   // ★★ 带 cookie ★★
  });

  return res.json();
}

// POST 请求，自动带上 cookie + JSON body
export async function apiPost(path, data) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'include',   // ★★ 带 cookie ★★
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data ?? {}),
  });

  return res.json();
}