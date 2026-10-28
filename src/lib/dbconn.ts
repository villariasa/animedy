import mysql, { type Pool, type PoolOptions, type ExecuteValues } from "mysql2/promise";

let pool: Pool | null = null;

/**
 * Lazily creates and returns a singleton MariaDB connection pool,
 * configured from environment variables.
 */
export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const options: PoolOptions = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "animedy",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
  };

  pool = mysql.createPool(options);
  return pool;
}

/**
 * Executes a parameterized SQL query against the pool and returns typed rows.
 */
export async function query<T>(sql: string, params: ReadonlyArray<unknown> = []): Promise<T> {
  const activePool = getPool();
  const [rows] = await activePool.execute(sql, params as ExecuteValues);
  return rows as T;
}

/**
 * Closes the connection pool. Intended for graceful shutdown / test teardown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
