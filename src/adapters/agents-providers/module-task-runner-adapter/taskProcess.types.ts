// @harness-uid u_rw64iex44n
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export type TaskChild = ChildProcessWithoutNullStreams;
export { TaskOutputOverflowError } from './TaskOutputOverflowError';
