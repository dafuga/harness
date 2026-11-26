/** The part of a thrown SvelteKit redirect that the route answers with. */
export type Redirected = { status: number; location: string };

/** The part of a thrown error that the route can answer with. */
export type Failed = { name: string; message: string };
