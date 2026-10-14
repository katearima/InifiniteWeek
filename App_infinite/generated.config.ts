import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { infinitePlansPolicy } from "./src/http.ts";
import { MongoClient } from "mongodb";
import { assembleApplication } from "./src/assembly.ts";

// Schema inspection never connects or invokes concept actions.
const database = new MongoClient("mongodb://127.0.0.1:27017").db("infiniteplans_shape");
export default {
  assemble: () => assembleApplication({ database }),
  title: "Infinite Plans",
  projections: [httpWire({ policy: infinitePlansPolicy("http://localhost:3000"), name: "InfinitePlansWireHttp" })],
  wireName: "InfinitePlansWire",
  design: { version: 1, documents: [
    new URL("./design/types.md", import.meta.url),
    new URL("./design/compositions/reusable/accounts.md", import.meta.url),
    new URL("./design/compositions/reusable/passwords.md", import.meta.url),
    new URL("./design/compositions/access.md", import.meta.url),
    new URL("./design/compositions/groups.md", import.meta.url),
    new URL("./design/compositions/events.md", import.meta.url),
    new URL("./design/compositions/plans.md", import.meta.url),
  ] },
};
