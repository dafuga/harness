export type Owners = (path: string) => string[];

export type Reason = { kind: 'reason'; explanation: { unit: string; behavior: string } };
