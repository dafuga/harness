/**
 * registerCodexCommand is called on a program the way buildProgram calls it. The `codex serve`
 * action runs only when commander dispatches to it, so the serve states parse argv on a fresh
 * program. Token files live in withTempDir directories. Bun.serve is replaced by a recording stub
 * so that no port is opened; the rest of the action runs as shipped.
 */
export type Served = {
	hostname: string;
	port: number;
	fetch: (request: Request) => Promise<Response>;
};
