const base = (
  import.meta.env.VITE_API_URL || "http://localhost:3001/api"
).replace(/\/$/, "");
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      credentials: "include",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error(
      "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo completar la solicitud.");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const post = (path, data) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
