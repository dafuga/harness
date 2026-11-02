// @harness-uid u_i5bs2phohi
import type { RuntimeFailure } from '../../core/execution-runtimes/runtimeTypes';

export type Parsed<T> = { value: T } | { error: RuntimeFailure };

export type Fields = Record<string, unknown>;
