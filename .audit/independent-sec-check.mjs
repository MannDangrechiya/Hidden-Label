import { Client } from "pg";

const PG = { host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" };

async function run() {
  const client = new Client(PG);
  await client.connect();
  const users = await client.query('SELECT id, email, metadata FROM "user"');
  console.log("Admin Users in DB:");
  console.log(JSON.stringify(users.rows, null, 2));

  const authIdentities = await client.query('SELECT id, provider_identities FROM auth_identity');
  console.log("Auth Identities count:", authIdentities.rows.length);

  await client.end();
}

run().catch(console.error);
