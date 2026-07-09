/**
 * @mesh/relay — Convex HTTP Client
 *
 * Sets up a direct client to communicate with your serverless Convex database.
 */

import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load workspace package .env
dotenv.config();

// 2. Load root .env.local (useful for Convex CLI integration)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });

const CONVEX_URL = process.env.CONVEX_URL || "https://mock-deployment.convex.cloud";

export const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * Execute mutations / queries directly by name.
 */
export const api = {
  registrations: {
    register: "registrations:register" as any,
    isRegistered: "registrations:isRegistered" as any,
  },
  prekeys: {
    save: "prekeys:save" as any,
    get: "prekeys:get" as any,
  },
  packets: {
    enqueue: "packets:enqueue" as any,
    drain: "packets:drain" as any,
    getQueueDepth: "packets:getQueueDepth" as any,
    pruneExpired: "packets:pruneExpired" as any,
  }
};
