// @harness-uid u_xhueog5n2u
import type { hub } from './trackerPhoneFixture';

export type LifecycleFixture = ReturnType<typeof hub>;

export interface LifecycleRow {
	status: string;
	attentionRevision: string;
}
