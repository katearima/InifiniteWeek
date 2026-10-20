// Run one copy via bun run dev; stop any previous start process first.
import { MongoClient } from "mongodb";
import { initializeDefaultGroups } from "./host/bootstrap.ts";
import { createHttpApplication } from "./host/http.ts";
import { withFrontend } from "./host/frontend.ts";

const url = process.env.MONGODB_URL;
if (!url) throw new Error("MONGODB_URL is not set. See .env.example.");
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer between 1 and 65535.");
const publicOrigin = process.env.PUBLIC_ORIGIN ?? `http://localhost:${port}`;
const mongo = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
try {
  await mongo.connect();
  await initializeDefaultGroups(mongo.db());
  const application = createHttpApplication({ database: mongo.db() }, { publicOrigin });
  const fetch = process.env.NODE_ENV === "production"
    ? await withFrontend(application.fetch, `${import.meta.dir}/../dist`)
    : application.fetch;
  const server = Bun.serve({
    hostname: process.env.HOST ?? "127.0.0.1",
    port,
    maxRequestBodySize: 1024 * 1024,
    fetch,
  });
  console.log(`Infinite Plans API listening on ${server.url}; browser origin ${publicOrigin}`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await Promise.all([application.beginDrain(), server.stop(false)]);
      await mongo.close();
    } catch {
      console.error("HTTP shutdown failed; terminating without accepting further work.");
      process.exitCode = 1;
      await server.stop(true);
      await mongo.close();
    }
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  await mongo.close();
  throw error;
}
