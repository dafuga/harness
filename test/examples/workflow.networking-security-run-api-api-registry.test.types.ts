export type Reply = { data: unknown } | Error;

export type Replies = Record<string, Reply>;

export type Outcome = { output: unknown; calls: string[] } | { error: Error; calls: string[] };
