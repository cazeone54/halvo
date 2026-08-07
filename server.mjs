// Production server entry.
//
// `npm run build` emits a Web-Fetch request handler at dist/server/server.js
// (it exports `{ fetch }` — it does NOT listen on its own). This file serves
// that handler on the host's PORT using srvx, the server runtime TanStack Start
// already depends on. Hosts run it via `npm start`.
import server from "./dist/server/server.js";
import { serve } from "srvx";

serve({
  fetch: server.fetch.bind(server),
  port: Number(process.env.PORT) || 3000,
});
