import { createPool } from "./db.js";
import { createApp } from "./app.js";
const pool = createPool();
await pool.query("SELECT 1");
const server = createApp(pool).listen(process.env.PORT || 3001, () =>
  console.log(`Hey Chat API: http://localhost:${process.env.PORT || 3001}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
