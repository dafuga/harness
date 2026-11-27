// @harness-uid u_saa6wluo2j
import type { InboxReply } from '../../../models/development-tooling/TrackerInbox.types';
import type { Input } from './initializePreload.types';

/** The one read that tells a new window whether the change feed answers. */
export type LocalTrackerRead = (input: Input) => Promise<InboxReply<unknown>>;
