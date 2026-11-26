export type Invocation = { runtime: string; cli: string; args: string[] };

export type Fake = { file: string; exitCode: number; stderr?: string };
