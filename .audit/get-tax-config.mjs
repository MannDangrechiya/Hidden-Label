import { Client } from "pg";

const client = new Client({ host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" });
await client.connect();
const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%tax%'");
console.log("Tax tables:", tables.rows.map(r => r.table_name).join(", "));

for (const t of tables.rows) {
  const count = await client.query(`SELECT count(*)::int as c FROM "${t.table_name}"`);
  console.log(`Table ${t.table_name}: ${count.rows[0].c} rows`);
}

await client.end();
