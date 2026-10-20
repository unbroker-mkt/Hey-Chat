import { createPool, migrate } from "./db.js";
const pool = createPool();
try {
  await migrate(pool);
  console.log("Base de datos lista.");
} finally {
  await pool.end();
}
