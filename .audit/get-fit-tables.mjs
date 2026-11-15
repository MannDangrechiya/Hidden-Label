import { Client } from "pg";

const client = new Client({ host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" });
await client.connect();
const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%fit%'");
console.log("Fit tables:", res.rows.map(r => r.table_name).join(", "));
await client.end();
