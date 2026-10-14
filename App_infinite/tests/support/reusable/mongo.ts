import { type Db, MongoClient } from "mongodb";

const databases: string[] = [];
let sequence = 0;
let client: MongoClient | undefined;
let connecting: Promise<MongoClient> | undefined;
const prefix = `infiniteplans_test_${crypto.randomUUID().replaceAll("-", "")}_`;

/** Each test gets its own database. Never reset the application database. */
export async function testDatabase(): Promise<Db> {
  const url = process.env.MONGODB_TEST_URL;
  if (!url) throw new Error("Set MONGODB_TEST_URL to the local test server; see .env.example.");
  client ??= new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
  connecting ??= client.connect();
  await connecting;
  const name = `${prefix}${sequence++}`;
  databases.push(name);
  return client.db(name);
}
export async function cleanupDatabases() {
  try {
    if (client && connecting) {
      await connecting;
      for (const name of databases) await client.db(name).dropDatabase();
    }
  } finally {
    await client?.close();
    client = undefined;
    connecting = undefined;
    databases.length = 0;
  }
}
