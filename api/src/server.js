import { createPool, migrate } from "./db.js";
import { createApp } from "./app.js";
const pool = createPool();
try {
  await migrate(pool);
  console.log("Base de datos lista: tablas verificadas.");
} catch (error) {
  console.error("No se pudo preparar la base de datos:", error.code || error.name);
  await pool.end();
  process.exit(1);
}
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
