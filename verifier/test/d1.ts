// Minimal D1Database stand-in over node:sqlite, with the real migrations applied.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function testDb(): D1Database {
  const db = new DatabaseSync(":memory:");
  const dir = fileURLToPath(import.meta.resolve("../migrations/"));
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(join(dir, f), "utf8"));
  const prepare = (sql: string, params: unknown[] = []): D1PreparedStatement => {
    const stmt = {
      bind: (...p: unknown[]) => prepare(sql, p),
      first: async () => (db.prepare(sql).get(...(params as never[])) as unknown) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(params as never[])) }),
      run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...(params as never[])).changes) } }),
      _exec: () => db.prepare(sql).run(...(params as never[])),
    };
    return stmt as unknown as D1PreparedStatement;
  };
  return {
    prepare: (sql: string) => prepare(sql),
    batch: async (stmts: D1PreparedStatement[]) => {
      db.exec("BEGIN");
      try {
        for (const s of stmts) (s as unknown as { _exec: () => void })._exec();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return [];
    },
    dump: () => ({
      badges: db.prepare("SELECT * FROM badges").all(),
      attempts: db.prepare("SELECT * FROM attempts").all(),
      apps: db.prepare("SELECT * FROM apps").all(),
      challenges: db.prepare("SELECT * FROM challenges").all(),
      bindings: db.prepare("SELECT * FROM bindings").all(),
    }),
  } as unknown as D1Database;
}
