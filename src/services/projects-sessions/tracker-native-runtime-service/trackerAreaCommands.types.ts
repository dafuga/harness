// @harness-uid u_bl6xl2h4a3
import type { TrackerDispatchItem } from '../../agents-providers/TrackerDispatcherService.types';
export type Item = Pick<
	TrackerDispatchItem,
	'id' | 'title' | 'notes' | 'project' | 'agent' | 'repo'
>;
export type Attempt = { token: string; attempt: number };
