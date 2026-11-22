import type { call } from './collaboration.function.add-comment.fixtures';

export type Outcome = Awaited<ReturnType<typeof call>>;
