import { normalizeApiUrl } from "./api-url.js";

const base = normalizeApiUrl(import.meta.env.VITE_API_URL);
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

export function uploadFile(path, file, body, requestId, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}${path}`);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    const aborted = () => xhr.abort();
    signal?.addEventListener("abort", aborted, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", aborted);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        return reject(
          new Error(
            "El servidor no pudo recibir el archivo. Intenta de nuevo.",
          ),
        );
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else
        reject(
          Object.assign(
            new Error(data.error || "No se pudo enviar el archivo."),
            { status: xhr.status },
          ),
        );
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "No se pudo conectar para subir el archivo. Puedes volver a intentar.",
        ),
      );
    xhr.ontimeout = () =>
      reject(new Error("La subida tardó demasiado. Puedes volver a intentar."));
    xhr.onabort = () => reject(new Error("Subida cancelada."));
    const form = new FormData();
    form.append("body", body);
    form.append("requestId", requestId);
    form.append("file", file);
    if (signal?.aborted) {
      reject(new Error("Subida cancelada."));
      return;
    }
    xhr.send(form);
  });
}
export async function fetchAttachment(id, signal) {
  const response = await fetch(`${base}/attachments/${id}`, {
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo descargar el archivo.");
  }
  return response.blob();
}
