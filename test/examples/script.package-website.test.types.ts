/**
 * scripts/package-website.ts exports nothing: it works when it runs, as the build runs it
 * (`bun scripts/package-website.ts`). Each test runs the real script under Bun in a temporary
 * project folder, since its paths are relative to the working directory, then reads back what the
 * folder holds. Bun.build rejects a failed bundle by default, so the branch that throws
 * ReportCliBundleError is reached only through a stub that resolves a result with success false.
 */
export type Thrown = { name: string; code?: string; message: string; errors?: string[] };

export type Run = { thrown?: Thrown };
