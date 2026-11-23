export type SpawnCall = { command: string[] };

export type ScriptRun = { calls: SpawnCall[]; exits: number[] };
