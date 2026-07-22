// Force TypeScript to load module augmentations from TanStack Start's
// client-core package, which extends `@tanstack/router-core`'s
// FilebaseRouteOptionsInterface with the `server: { handlers }` property
// used by our server routes under src/routes/api/**.
import "@tanstack/start-client-core";
