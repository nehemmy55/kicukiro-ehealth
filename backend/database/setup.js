// Creates the database and all tables from schema.sql.
// Usage: npm run db:setup
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  const dbName = process.env.DB_NAME || 'kicukiro_ehealth';
  let sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  sql = sql.replace(/kicukiro_ehealth/g, dbName);
  await conn.query(sql);
  await conn.end();
  console.log(`✔ Database "${dbName}" and tables created.`);
})().catch((err) => {
  console.error('✖ Setup failed:', err.message);
  process.exit(1);
});
