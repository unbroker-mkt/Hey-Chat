import "dotenv/config";
import pg from "pg";
export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("Configura DATABASE_URL en api/.env");
  return new pg.Pool({ connectionString });
}
export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY, username varchar(24) UNIQUE NOT NULL,
      password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS contacts (
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(owner_id, contact_id), CHECK(owner_id <> contact_id)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY, user_a uuid NOT NULL REFERENCES users(id), user_b uuid NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_a, user_b), CHECK(user_a < user_b)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL REFERENCES users(id), body varchar(4000) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS messages_conversation_id ON messages(conversation_id, id DESC);
  `);
}
