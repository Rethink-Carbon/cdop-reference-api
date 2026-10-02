import type { Caller } from "./http/context.js";

export type AppEnv = {
  Variables: {
    caller: Caller;
    requestId: string;
  };
};
