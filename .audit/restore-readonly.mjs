import { Client } from "pg";

const client = new Client({ host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" });
await client.connect();
await client.query('UPDATE "user" SET metadata = $1 WHERE email = $2', [JSON.stringify({ role: "readonly" }), "audit.readonly@thehiddenlabel.com"]);
console.log("Restored readonly role successfully");
await client.end();
