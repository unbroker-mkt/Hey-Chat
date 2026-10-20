import { useEffect, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { fetchAttachment } from "./api";
import { formatSize } from "./files";
export function Attachment({ attachment, onImageLoad }) {
  const [url, setUrl] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const image = attachment.mime === "image/webp";
  useEffect(() => {
    if (!image) return;
    const controller = new AbortController();
    let objectUrl;
    setUrl(null);
    setError("");
    fetchAttachment(attachment.id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, image, attempt]);
  async function download() {
    setBusy(true);
    setError("");
    try {
      const link = document.createElement("a");
      const objectUrl =
        url || URL.createObjectURL(await fetchAttachment(attachment.id));
      link.href = objectUrl;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (!url) setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="attachment">
      {image &&
        (url ? (
          <img
            className="attachment-image"
            src={url}
            alt={attachment.name}
            width={attachment.width}
            height={attachment.height}
            onLoad={onImageLoad}
            onError={() => setError("No pudimos mostrar la imagen.")}
          />
        ) : (
          !error && (
            <div className="attachment-loading">
              <LoaderCircle className="spin" size={20} /> Cargando imagen…
            </div>
          )
        ))}
      <div className="attachment-details">
        <FileText size={20} />
        <span>
          <strong>{attachment.name}</strong>
          <small>{formatSize(attachment.size)}</small>
        </span>
        <button
          type="button"
          className="attachment-download"
          aria-label={`Descargar ${attachment.name}`}
          disabled={busy}
          onClick={download}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Download size={18} />
          )}
        </button>
      </div>
      {error && (
        <div className="attachment-error" role="alert">
          {error}
          {image && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
