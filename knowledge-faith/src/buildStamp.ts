declare const __DD_BUILD_SHA__: string;
declare const __DD_BUILD_TIME__: string;

/** Non-secret release mark. Vite replaces the constants at build time. */
export const buildStamp = {
  sha: __DD_BUILD_SHA__,
  builtAt: __DD_BUILD_TIME__,
};
