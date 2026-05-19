import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function isMysqlConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_HOST &&
      process.env.MYSQL_USER &&
      process.env.MYSQL_DATABASE
  )
}

export function getMysqlPool(): mysql.Pool {
  if (pool) {
    return pool
  }

  const host = process.env.MYSQL_HOST
  const user = process.env.MYSQL_USER
  const database = process.env.MYSQL_DATABASE

  if (!host || !user || !database) {
    throw new Error('MySQL is not configured. Set MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE.')
  }

  pool = mysql.createPool({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user,
    password: process.env.MYSQL_PASSWORD || '',
    database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  })

  return pool
}
