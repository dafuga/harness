export type Bridge = Record<string, (input?: object) => Promise<unknown>>;

export type Entity = Record<string, unknown> & { id: string };

export type Snapshot = { entities: Entity[] };
