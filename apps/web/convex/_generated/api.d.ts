/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as crosswords from "../crosswords.js";
import type * as folders from "../folders.js";
import type * as presentations from "../presentations.js";
import type * as quizzes from "../quizzes.js";
import type * as reports from "../reports.js";
import type * as sessions from "../sessions.js";
import type * as share from "../share.js";
import type * as sharedAttempts from "../sharedAttempts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  crosswords: typeof crosswords;
  folders: typeof folders;
  presentations: typeof presentations;
  quizzes: typeof quizzes;
  reports: typeof reports;
  sessions: typeof sessions;
  share: typeof share;
  sharedAttempts: typeof sharedAttempts;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
