import { Client } from "pg";

const client = new Client({ host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" });
await client.connect();
const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'order'");
console.log("Order columns:", res.rows.map(r => r.column_name).join(", "));
await client.end();
