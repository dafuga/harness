export type Call = Record<string, unknown>;

export type Phone = { __remotePhone: { set: (state: string) => void } };
