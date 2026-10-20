# Hey Chat 💜

Chat con una interfaz sencilla y colorida. React + Vite + Tailwind CSS en `cliente/`; Node + Express + Postgres en `api/`.

## Empezar

Necesitas Node.js 22.12+ (o 24+), npm y PostgreSQL 14+.

```sh
npm install
cp api/.env.example api/.env
cp cliente/.env.example cliente/.env
```

Crea una base de datos y configura `DATABASE_URL` en `api/.env`. Por ejemplo, con Postgres local:

```sh
createdb hey_chat
# Ajusta usuario, contraseña, host y puerto de DATABASE_URL para tu instalación.
npm run db:migrate
npm run dev
```

Abre http://localhost:5173. El API escucha en http://localhost:3001. Crea dos usuarios en navegadores o perfiles separados, agrega el nombre de uno desde el otro y empieza a conversar. Los mensajes entrantes se consultan cada 2 segundos; la lista de conversaciones, cada 4 segundos. No hay usuarios ni conversaciones ficticios.

## Variables

| Lugar   | Variable           | Uso                                                                                                                                                                                                |
| ------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API     | `DATABASE_URL`     | URL de conexión a PostgreSQL, obligatoria. Usa `sslmode=verify-full` con certificados válidos cuando tu proveedor lo requiera.                                                                     |
| API     | `CLIENT_ORIGIN`    | Origen exacto del cliente, sin barra final. Predeterminado: `http://localhost:5173`.                                                                                                               |
| API     | `PORT`             | Puerto del servidor, predeterminado: `3001`.                                                                                                                                                       |
| API     | `NODE_ENV`         | Usa `production` para activar cookies Secure (HTTPS).                                                                                                                                              |
| API     | `COOKIE_SAME_SITE` | `lax` por defecto. Para dominios de sitios diferentes: `none` junto con HTTPS y `NODE_ENV=production`. Algunos navegadores bloquean cookies de terceros; se recomienda servir bajo el mismo sitio. |
| API     | `TRUST_PROXY`      | `1` solamente si hay exactamente un proxy confiable delante del API.                                                                                                                               |
| Cliente | `VITE_API_URL`     | URL del API, por ejemplo `https://api.example.com` o `https://api.example.com/api`. El cliente agrega `/api` cuando falta. Se incorpora al compilar; no es un secreto.                                                                    |

Nunca subas los archivos `.env` a GitHub. Las credenciales de Postgres pertenecen únicamente al API.

El API permite explícitamente `https://heychat-cliente-07u5oet.apps.unbroker.cloud`
además del origen configurado en `CLIENT_ORIGIN`. La misma lista se aplica a
CORS (con credenciales) y a la protección de origen de las mutaciones. Los demás
orígenes se rechazan. Para producción configura `CLIENT_ORIGIN` con esa URL y
`NODE_ENV=production`; si el API está en otro sitio, usa además
`COOKIE_SAME_SITE=none` y HTTPS. Vuelve a desplegar el API tras actualizar el código.

## Funciones

- Registro y sesión con nombre de usuario (3–24 letras, números o `_`) y contraseña (8–128 caracteres).
- Nombres normalizados a minúsculas, únicos; contraseñas con scrypt y sal aleatoria.
- Sesiones de 7 días, token aleatorio almacenado como hash en Postgres y cookie HttpOnly; cierre de sesión revocable.
- Protección de origen para mutaciones, CORS específico, límites de solicitudes y validación del servidor.
- Agregar contactos por nombre exacto y buscar en tu lista. Agregar un contacto no agrega automáticamente al remitente en la agenda del destinatario.
- Conversaciones directas únicas por pareja; ambos participantes ven la conversación y pueden responder.
- Historial persistente, mensajes de hasta 4.000 caracteres y paginación de 100 mensajes.
- Modo claro y oscuro con botón en el acceso y el chat. Recuerda la elección en este navegador y usa el tema del sistema la primera vez.
- Diseño adaptable a móvil, teclado, estados vacíos, errores de conexión y formularios accesibles.

## API

Todas las rutas bajo `/api`. Las rutas privadas requieren la cookie de sesión. En las mutaciones envía `Origin` igual a `CLIENT_ORIGIN` y `Content-Type: application/json`. El cliente utiliza `credentials: 'include'`.

| Método | Ruta                          | Entrada / resultado                                                                                |
| ------ | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| GET    | `/health`                     | Estado de conexión a Postgres.                                                                     |
| POST   | `/auth/register`              | `{ username, password }` → `{ user }`, crea sesión.                                                |
| POST   | `/auth/login`                 | `{ username, password }` → `{ user }`, crea sesión.                                                |
| POST   | `/auth/logout`                | Revoca sesión actual y borra cookie.                                                               |
| GET    | `/auth/me`                    | `{ user: { id, username } }`.                                                                      |
| GET    | `/contacts`                   | `{ contacts }`.                                                                                    |
| POST   | `/contacts`                   | `{ username }` → `{ contact }`.                                                                    |
| DELETE | `/contacts/:id`               | Quita contacto de la agenda; conserva historial.                                                   |
| GET    | `/conversations`              | Conversaciones con contacto y último mensaje.                                                      |
| POST   | `/conversations`              | `{ contactId }` → `{ conversation: { id } }`; requiere contacto agregado.                          |
| GET    | `/conversations/:id/messages` | `{ messages, hasMore }`. `?before=id` para anteriores o `?after=id` para nuevos. IDs como cadenas. |
| POST   | `/conversations/:id/messages` | `{ body }` → `{ message }`.                                                                        |

Errores en JSON `{ error }` y códigos 400, 401, 403, 404, 409, 413, 429 o 500. Las conversaciones ajenas devuelven 404. Las consultas SQL usan parámetros. Los mensajes son texto, nunca HTML.

## Verificación

```sh
npm run build
npm test
TEST_DATABASE_URL=postgresql://localhost/hey_chat_test npm test
```

Sin `TEST_DATABASE_URL` se prueba el hashing y se omite explícitamente la prueba de integración. Con ella, se prueba contra Postgres real: registro, duplicados, login, CSRF, contactos, autorización, mensajes bidireccionales, cursores y logout. Usa una base de pruebas independiente: crea sus tablas y elimina únicamente los usuarios generados por la prueba.

## Producción

1. Provisiona Postgres y define las variables del API.
2. Ejecuta `npm ci` e inicia `npm start -w api`. El API crea las tablas faltantes antes de aceptar solicitudes. `npm run db:migrate` también permite hacerlo manualmente.
3. Define `VITE_API_URL`, ejecuta `npm run build` y sirve `cliente/dist` por HTTPS.
4. Define `CLIENT_ORIGIN` con el origen HTTPS del cliente y `NODE_ENV=production` en el API.

El repositorio no aprovisiona servicios ni incluye credenciales. La aplicación ofrece chat de texto; no incluye recuperación de contraseña, adjuntos, cifrado de extremo a extremo ni confirmaciones de lectura. El límite de solicitudes está en memoria por proceso; para varias réplicas utiliza un almacén compartido.

### Configuración del cliente desplegado

En el servicio del cliente configura:

```env
VITE_API_URL=https://hey-chat-07u5oet.apps.unbroker.cloud
```

También se acepta la misma URL terminada en `/api`. La petición de sesión debe
ir a `https://hey-chat-07u5oet.apps.unbroker.cloud/api/auth/me`.
Las variables de Vite se incorporan durante la compilación: recompila y vuelve
a desplegar el cliente después de cambiar la variable o actualizar este código.
Un `401` en esa ruta sin sesión es normal; el cliente muestra el inicio de sesión.

### Errores de despliegue

- `42P01` significa que Postgres no encuentra una tabla. El arranque ahora ejecuta
  la inicialización del esquema en una transacción antes de escuchar peticiones.
  Usa un bloqueo de Postgres para coordinar varias réplicas; no borra datos ni
  recrea tablas existentes. El usuario de `DATABASE_URL` necesita permisos para
  crear las tablas e índices. Si falla, el proceso termina en lugar de aceptar
  registros que devolverían 500.
- `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` significa que hay un proxy enviando
  `X-Forwarded-For` y Express no está configurado para confiar en él. Si el API
  recibe tráfico exclusivamente a través de un proxy confiable, configura
  `TRUST_PROXY=1` en el servicio del API. No uses `trust proxy=true`: permitiría
  confiar en direcciones aportadas por el cliente. Si la infraestructura usa
  varios saltos, confirma la topología antes de cambiar esta configuración.
