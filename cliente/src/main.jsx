import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  MessageCircle,
  Paperclip,
  FileText,
  Plus,
  Search,
  Send,
  LogOut,
  ArrowLeft,
  X,
  Smile,
  ArrowRight,
  Sparkles,
  Users,
  LockKeyhole,
  Eye,
  EyeOff,
  Check,
  LoaderCircle,
} from "lucide-react";
import { api, post, uploadFile } from "./api";
import "./styles.css";
import { Attachment } from "./Attachment.jsx";
import { optimizeFile, formatSize, FILE_ACCEPT } from "./files.js";
import { ThemeProvider, ThemeToggle } from "./theme.jsx";

const palette = ["purple", "pink", "mint", "orange", "blue"];
function Avatar({ name, size = "", self = false }) {
  const color =
    palette[
      [...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) %
        palette.length
    ];
  return (
    <span className={`avatar ${color} ${size} ${self ? "self-avatar" : ""}`}>
      {name?.slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <MessageCircle size={24} strokeWidth={2.5} />
      </span>
      <span>
        hey<span className="brand-light">chat</span>
        <span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function Spinner() {
  return <LoaderCircle className="spin" size={19} />;
}
function Auth({ onLogin }) {
  const [register, setRegister] = useState(false),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await post(
        `/auth/${register ? "register" : "login"}`,
        Object.fromEntries(data),
      );
      onLogin(result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand-row">
          <Brand />
          <ThemeToggle />
        </div>
        <div className="story-copy">
          <span className="eyebrow">
            <span className="little-dot" /> MENOS DISTANCIA, MÁS CONVERSACIONES
          </span>
          <h1>
            Un pequeño hey.
            <br />
            Una gran
            <br />
            <span>conexión.</span>
            <span className="sun">✳</span>
          </h1>
          <p>
            Tu gente, tus historias y esos mensajes
            <br className="desktop-break" /> que te alegran el día. Todo empieza
            aquí.
          </p>
          <div className="chat-art" aria-hidden="true">
            <div className="art-message art-one">
              <span className="art-face">☺</span>
              <div>
                Hey, ¿cómo va tu día?
                <small>Un mensaje puede cambiarlo todo.</small>
              </div>
              <span>✦</span>
            </div>
            <div className="art-message art-two">
              Mucho mejor ahora 💜
              <Check size={15} />
            </div>
            <div className="art-message art-three">
              <span>✌</span> Siempre hay algo que contar.
            </div>
          </div>
        </div>
        <div className="story-footer">
          <span>Hecho para conectar.</span>
          <span>
            Con un poquito de color <span className="heart">♥</span>
          </span>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-top">
          TU NUEVO LUGAR FAVORITO <Sparkles size={16} />
        </div>
        <div className="auth-card">
          <span className="hello-sticker">
            {register ? "¡Hola, tú! ✨" : "¡Qué bueno verte! 👋"}
          </span>
          <h2>{register ? "Empieza con un hey." : "De vuelta a tu gente."}</h2>
          <p>
            {register
              ? "Crea tu cuenta y encuentra a tus personas favoritas."
              : "Inicia sesión. Seguro tienes algo bonito que contar."}
          </p>
          <div className="auth-tabs">
            <button
              type="button"
              className={!register ? "active" : ""}
              onClick={() => {
                setRegister(false);
                setError("");
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={register ? "active" : ""}
              onClick={() => {
                setRegister(true);
                setError("");
              }}
            >
              Crear cuenta
            </button>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="username">Nombre de usuario</label>
            <div className="input-wrap">
              <span className="input-at">@</span>
              <input
                id="username"
                name="username"
                placeholder="tu_nombre"
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_]{3,24}"
                autoCapitalize="none"
                autoComplete="username"
                spellCheck="false"
              />
            </div>
            {register && (
              <small className="field-hint">
                3–24 letras, números o guiones bajos. Sin espacios.
              </small>
            )}
            <label htmlFor="password">Contraseña</label>
            <div className="input-wrap">
              <LockKeyhole size={18} />
              <input
                id="password"
                name="password"
                placeholder="Al menos 8 caracteres"
                type={show ? "text" : "password"}
                required
                minLength={8}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
              />
              <button
                className="icon-button"
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary auth-submit" disabled={busy}>
              {busy ? (
                <Spinner />
              ) : (
                <>
                  {register ? "Crear mi cuenta" : "Entrar a Hey Chat"}
                  <ArrowRight size={19} />
                </>
              )}
            </button>
          </form>
          <div className="auth-note">
            <LockKeyhole size={14} /> Tu contraseña se guarda de forma segura.
          </div>
        </div>
        <div className="auth-bottom">
          <span className="dot violet" />
          <span className="dot coral" />
          <span className="dot green" /> Conversaciones con todos tus colores.
        </div>
      </section>
    </main>
  );
}
function AddContact({ onClose, onAdded }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const username = new FormData(e.currentTarget).get("username");
    try {
      const { contact } = await post("/contacts", { username });
      await onAdded(contact);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="contact-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="modal-top">
        <span className="modal-symbol">
          <Users />
        </span>
        <button onClick={onClose} className="icon-button" aria-label="Cerrar">
          <X />
        </button>
      </div>
      <h2>
        Una persona más.
        <br />
        Mil cosas que contar.
      </h2>
      <p>Agrega a alguien con su nombre de usuario y envíale tu primer hey.</p>
      <form onSubmit={submit}>
        <label htmlFor="contact">Nombre de usuario</label>
        <div className="input-wrap">
          <span>@</span>
          <input
            id="contact"
            name="username"
            placeholder="nombre_de_tu_amigo"
            autoFocus
            required
            minLength={3}
            maxLength={24}
            autoCapitalize="none"
            autoComplete="off"
          />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary auth-submit" disabled={busy}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              Agregar y conversar <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </dialog>
  );
}
function Chat({ user, onLogout }) {
  const [conversations, setConversations] = useState([]),
    [contacts, setContacts] = useState([]),
    [selected, setSelected] = useState(null),
    [tab, setTab] = useState("chats"),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [logoutBusy, setLogoutBusy] = useState(false);
  async function refresh() {
    const [a, b] = await Promise.all([api("/conversations"), api("/contacts")]);
    setConversations(a.conversations);
    setContacts(b.contacts);
  }
  useEffect(() => {
    let active = true;
    let timer;
    async function tick() {
      try {
        const [a, b] = await Promise.all([
          api("/conversations"),
          api("/contacts"),
        ]);
        if (active) {
          setConversations(a.conversations);
          setContacts(b.contacts);
          setReady(true);
          setError("");
        }
      } catch (e) {
        if (active) {
          if (e.status === 401) onLogout();
          else setError(e.message);
        }
      } finally {
        if (active) timer = setTimeout(tick, 4000);
      }
    }
    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [onLogout]);
  async function start(contact) {
    try {
      const { conversation } = await post("/conversations", {
        contactId: contact.id,
      });
      setSelected({ id: conversation.id, contact });
      setTab("chats");
      await refresh();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }
  async function logout() {
    setLogoutBusy(true);
    try {
      await post("/auth/logout", {});
      onLogout();
    } catch (e) {
      setError(e.message);
      setLogoutBusy(false);
    }
  }
  const items = (
    tab === "chats"
      ? conversations
      : contacts.map((contact) => ({ id: contact.id, contact }))
  ).filter((c) => c.contact.username.includes(search.toLowerCase()));
  return (
    <main className="app-shell">
      <nav className="rail" aria-label="Navegación">
        <span className="rail-logo">
          <MessageCircle size={26} />
        </span>
        <button
          className={tab === "chats" ? "rail-button selected" : "rail-button"}
          onClick={() => setTab("chats")}
          aria-label="Conversaciones"
          title="Conversaciones"
        >
          <MessageCircle size={23} />
        </button>
        <button
          className={
            tab === "contacts" ? "rail-button selected" : "rail-button"
          }
          onClick={() => setTab("contacts")}
          aria-label="Contactos"
          title="Contactos"
        >
          <Users size={23} />
        </button>
        <div className="rail-bottom">
          <span className="rail-spark">✳</span>
          <button
            className="rail-button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={logout}
            disabled={logoutBusy}
          >
            <LogOut size={21} />
          </button>
          <Avatar name={user.username} self />
        </div>
      </nav>
      <aside className={`sidebar ${selected ? "mobile-hidden" : ""}`}>
        <header className="sidebar-brand">
          <Brand />
          <ThemeToggle />
        </header>
        <div className="sidebar-heading">
          <div>
            <h1>{tab === "chats" ? "Tus conversaciones" : "Tus contactos"}</h1>
            <p>Un hey puede ser el comienzo.</p>
          </div>
          <button
            className="add-button"
            onClick={() => setModal(true)}
            aria-label="Agregar contacto"
            title="Agregar contacto"
          >
            <Plus size={22} />
          </button>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Buscar por nombre de usuario"
            placeholder="Busca a tu gente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="list-tabs">
          <button
            className={tab === "chats" ? "active" : ""}
            onClick={() => setTab("chats")}
          >
            Chats <span>{conversations.length}</span>
          </button>
          <button
            className={tab === "contacts" ? "active" : ""}
            onClick={() => setTab("contacts")}
          >
            Contactos <span>{contacts.length}</span>
          </button>
        </div>
        {error && (
          <p className="error sidebar-error" role="alert">
            {error}
          </p>
        )}
        <div className="contact-list">
          {!ready && !error ? (
            <div className="list-empty">
              <Spinner /> Cargando tus conversaciones…
            </div>
          ) : items.length ? (
            items.map((c) => (
              <button
                key={c.id}
                className={`contact-row ${selected?.id === c.id ? "active" : ""}`}
                onClick={() =>
                  tab === "chats"
                    ? setSelected(c)
                    : start(c.contact).catch(() => {})
                }
              >
                <Avatar name={c.contact.username} />
                <span className="contact-info">
                  <span className="contact-name">{c.contact.username}</span>
                  <span className="contact-preview">
                    {c.last_message ||
                      (tab === "contacts"
                        ? "Di hey y empieza a conversar"
                        : "Tu conversación empieza aquí")}
                  </span>
                </span>
                {c.updated_at && (
                  <time>
                    {new Date(c.updated_at).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                )}
              </button>
            ))
          ) : (
            <div className="list-empty">
              <span className="empty-list-icon">
                <MessageCircle size={24} />
              </span>
              <strong>
                {search
                  ? "No hay coincidencias"
                  : tab === "chats"
                    ? "Aquí van tus próximos hey"
                    : "Tu gente está por llegar"}
              </strong>
              <p>
                {search
                  ? "Prueba con otro nombre."
                  : "Agrega un contacto para empezar."}
              </p>
              {!search && (
                <button className="text-button" onClick={() => setModal(true)}>
                  Agregar contacto <Plus size={15} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="sidebar-banner">
          <span>✦</span>
          <div>
            Hazle el día a alguien.<small>Envíale un hey.</small>
          </div>
          <span>☺</span>
        </div>
        <div className="profile">
          <Avatar name={user.username} size="small" />
          <span>
            <strong>@{user.username}</strong>
            <small>Este es tu espacio.</small>
          </span>
          <button
            onClick={logout}
            disabled={logoutBusy}
            className="icon-button mobile-logout"
            aria-label="Cerrar sesión"
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>
      <section
        className={`conversation-area ${!selected ? "mobile-hidden" : ""}`}
      >
        {selected ? (
          <Conversation
            key={selected.id}
            conversation={selected}
            user={user}
            onBack={() => setSelected(null)}
            onSent={refresh}
            onExpired={onLogout}
          />
        ) : (
          <div className="welcome">
            <div className="welcome-art" aria-hidden="true">
              <span className="floating-spark">✦</span>
              <div className="bubble-back">hey!</div>
              <div className="bubble-front">
                <Smile size={62} strokeWidth={1.5} />
              </div>
              <span className="floating-heart">♥</span>
              <span className="floating-dot" />
            </div>
            <span className="eyebrow">
              LAS BUENAS CONVERSACIONES EMPIEZAN AQUÍ
            </span>
            <h2>
              Tu gente. Tu espacio.
              <br />
              <span>Tu próximo hey.</span>
            </h2>
            <p>
              Busca a alguien que conoces, saluda
              <br />y deja que la conversación fluya.
            </p>
            <button className="primary" onClick={() => setModal(true)}>
              <Plus size={19} /> Agregar mi primer contacto
            </button>
            <div className="welcome-chips">
              <span>
                <span className="dot violet" /> Simple
              </span>
              <span>
                <span className="dot coral" /> Cercano
              </span>
              <span>
                <span className="dot green" /> Muy tú
              </span>
            </div>
          </div>
        )}
      </section>
      {modal && (
        <AddContact
          onClose={() => setModal(false)}
          onAdded={async (contact) => {
            await start(contact);
            setModal(false);
          }}
        />
      )}
    </main>
  );
}
function Conversation({ conversation, user, onBack, onSent, onExpired }) {
  const [messages, setMessages] = useState([]),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [sending, setSending] = useState(false),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [olderBusy, setOlderBusy] = useState(false),
    [selectedFile, setSelectedFile] = useState(null),
    [preparing, setPreparing] = useState(false),
    [progress, setProgress] = useState(0),
    [previewUrl, setPreviewUrl] = useState(null);
  const fileInput = useRef(null),
    uploadController = useRef(null),
    selectionVersion = useRef(0);
  useEffect(() => {
    if (!selectedFile?.file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  useEffect(
    () => () => {
      selectionVersion.current++;
      uploadController.current?.abort();
    },
    [],
  );
  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = ++selectionVersion.current;
    setPreparing(true);
    setError("");
    setSelectedFile(null);
    try {
      const optimized = await optimizeFile(file);
      if (version === selectionVersion.current)
        setSelectedFile({
          file: optimized,
          originalSize: file.size,
          requestId: crypto.randomUUID(),
        });
    } catch (e) {
      if (version === selectionVersion.current) setError(e.message);
    } finally {
      if (version === selectionVersion.current) setPreparing(false);
    }
  }
  const last = useRef(null),
    initialized = useRef(false),
    bottom = useRef(null),
    scroll = useRef(null),
    nearBottom = useRef(true),
    mounted = useRef(true);
  const endpoint = `/conversations/${conversation.id}/messages`;
  const merge = (incoming) =>
    setMessages((previous) => {
      const map = new Map(previous.map((m) => [m.id, m]));
      incoming.forEach((m) => map.set(m.id, m));
      return [...map.values()].sort((a, b) =>
        BigInt(a.id) < BigInt(b.id) ? -1 : 1,
      );
    });
  useEffect(() => {
    mounted.current = true;
    let active = true,
      timer;
    async function tick() {
      try {
        const data = await api(
          endpoint + (last.current ? `?after=${last.current}` : ""),
        );
        if (active) {
          merge(data.messages);
          if (!initialized.current) {
            setMore(data.hasMore);
            initialized.current = true;
          }
          if (data.messages.length) last.current = data.messages.at(-1).id;
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          setError(e.message);
          setLoading(false);
          if (e.status === 401) onExpired();
        }
      } finally {
        if (active) timer = setTimeout(tick, 2000);
      }
    }
    tick();
    return () => {
      active = false;
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [endpoint, onExpired]);
  useEffect(() => {
    if (nearBottom.current)
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  async function older() {
    setOlderBusy(true);
    try {
      const data = await api(`${endpoint}?before=${messages[0].id}`);
      const el = scroll.current,
        oldHeight = el.scrollHeight;
      nearBottom.current = false;
      merge(data.messages);
      setMore(data.hasMore);
      requestAnimationFrame(() => {
        if (mounted.current) el.scrollTop += el.scrollHeight - oldHeight;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setOlderBusy(false);
    }
  }
  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if ((!body && !selectedFile) || sending || preparing) return;
    setSending(true);
    setError("");
    try {
      setProgress(0);
      uploadController.current = new AbortController();
      const { message } = selectedFile
        ? await uploadFile(
            `/conversations/${conversation.id}/attachments`,
            selectedFile.file,
            body,
            selectedFile.requestId,
            (value) => {
              if (mounted.current) setProgress(value);
            },
            uploadController.current.signal,
          )
        : await post(endpoint, { body });
      if (!mounted.current) return;
      nearBottom.current = true;
      merge([message]);
      setText("");
      setSelectedFile(null);
      onSent().catch(() => {});
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setSending(false);
    }
  }
  return (
    <>
      <header className="conversation-header">
        <button
          className="icon-button back-button"
          onClick={onBack}
          aria-label="Volver a conversaciones"
        >
          <ArrowLeft />
        </button>
        <Avatar name={conversation.contact.username} />
        <div>
          <h2>{conversation.contact.username}</h2>
          <p>@{conversation.contact.username}</p>
        </div>
        <span className="conversation-tag">
          <span className="dot green" /> Conversación directa
        </span>
        <ThemeToggle />
      </header>
      <div
        className="message-scroll"
        ref={scroll}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        {more && (
          <button className="older-button" disabled={olderBusy} onClick={older}>
            {olderBusy ? "Cargando…" : "Ver mensajes anteriores"}
          </button>
        )}
        {loading ? (
          <div className="conversation-empty">
            <Spinner /> Cargando conversación…
          </div>
        ) : !messages.length ? (
          <div className="conversation-empty">
            <span className="first-hey">👋</span>
            <h3>Todo empieza con un hey.</h3>
            <p>
              Este es el comienzo de tu conversación con @
              {conversation.contact.username}.
            </p>
            <button
              className="suggestion"
              onClick={() => setText("¡Hey! 👋 ¿Cómo estás?")}
            >
              ¡Hey! 👋 ¿Cómo estás?
            </button>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === user.id;
            const day = new Date(m.created_at).toLocaleDateString("es", {
              day: "numeric",
              month: "long",
            });
            const newDay =
              i === 0 ||
              new Date(messages[i - 1].created_at).toDateString() !==
                new Date(m.created_at).toDateString();
            return (
              <React.Fragment key={m.id}>
                {newDay && (
                  <div className="day-label">
                    <span>{day}</span>
                  </div>
                )}
                <div className={`message-row ${mine ? "mine" : ""}`}>
                  {!mine && (
                    <Avatar name={conversation.contact.username} size="tiny" />
                  )}
                  <div className="message-bubble">
                    {m.attachment && (
                      <Attachment
                        attachment={m.attachment}
                        onImageLoad={() => {
                          if (nearBottom.current)
                            bottom.current?.scrollIntoView({ block: "end" });
                        }}
                      />
                    )}
                    {m.body && <p>{m.body}</p>}
                    <time>
                      {new Date(m.created_at).toLocaleTimeString("es", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {mine && <Check size={13} aria-label="Enviado" />}
                    </time>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      {error && (
        <p className="error conversation-error" role="alert">
          {error}
        </p>
      )}
      <form className="composer" onSubmit={send}>
        <input
          ref={fileInput}
          type="file"
          accept={FILE_ACCEPT}
          onChange={selectFile}
          hidden
          aria-label="Seleccionar archivo"
        />
        {preparing && (
          <div className="file-status" role="status">
            <Spinner /> Optimizando imagen…
          </div>
        )}
        {selectedFile && (
          <div className="file-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Imagen lista para enviar" />
            ) : (
              <FileText size={28} />
            )}
            <div>
              <strong>{selectedFile.file.name}</strong>
              <small>
                {formatSize(selectedFile.file.size)}
                {selectedFile.originalSize > selectedFile.file.size &&
                  ` · ${Math.round((1 - selectedFile.file.size / selectedFile.originalSize) * 100)}% menos peso`}
              </small>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Quitar archivo"
              disabled={sending}
              onClick={() => setSelectedFile(null)}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {sending && selectedFile && (
          <div className="file-status" role="status">
            <progress
              value={progress}
              max="100"
              aria-label="Progreso de subida"
            />
            {progress < 100 ? `Subiendo ${progress}%` : "Guardando archivo…"}
          </div>
        )}
        <div className="composer-input">
          <button
            type="button"
            className="icon-button"
            aria-label="Adjuntar imagen o documento"
            title="Adjuntar imagen o documento · hasta 20 MB"
            disabled={sending || preparing}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip size={21} />
          </button>
          <button
            type="button"
            className="icon-button emoji-button"
            aria-label="Agregar emoji de sonrisa"
            onClick={() =>
              setText((value) => (value.length < 3998 ? value + " 😊" : value))
            }
          >
            <Smile size={22} />
          </button>
          <textarea
            aria-label="Mensaje"
            placeholder="Escribe un hey, o algo más…"
            maxLength={4000}
            rows={1}
            value={text}
            disabled={sending}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send(e);
              }
            }}
          />
          <button
            className="send-button"
            disabled={sending || preparing || (!text.trim() && !selectedFile)}
            aria-label="Enviar mensaje"
          >
            {sending ? <Spinner /> : <Send size={20} />}
          </button>
        </div>
        <small>
          Enter para enviar <span>·</span> Shift + Enter para una nueva línea{" "}
          <span className="count">{text.length}/4000</span>
        </small>
      </form>
    </>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const logout = React.useCallback(() => setUser(null), []);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setUser((await api("/auth/me")).user);
    } catch (e) {
      if (e.status !== 401) setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (loading)
    return (
      <div className="boot">
        <Brand />
        <ThemeToggle />
        <Spinner />
        <p>Preparando tu espacio…</p>
      </div>
    );
  if (error)
    return (
      <div className="boot">
        <Brand />
        <ThemeToggle />
        <p role="alert">{error}</p>
        <button className="primary" onClick={load}>
          Volver a intentar
        </button>
      </div>
    );
  return user ? (
    <Chat user={user} onLogout={logout} />
  ) : (
    <Auth onLogin={setUser} />
  );
}
createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
