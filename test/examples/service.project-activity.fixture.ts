import type { History } from './service.project-activity.test.types';

export const subject = 'Show the agent roster in project activity';

export const unit = 'service.project-activity';

/** A history index with one newest revision on main, built from a made-up commit. */
export function historyOf(commit: string): History {
	return {
		branches: [{ name: 'main', head: commit }],
		revisions: [
			{
				commit,
				tree: '2f8a6c0e91b4d7305ac6e8f2d19b74a0c5e3f861',
				parents: ['b04f8e2d6a17c93e5f0b8d41a6e27c9f3d05b2a6'],
				subject,
				author: 'Mira Halvorsen',
				authoredAt: '2026-11-13T16:20:41+01:00',
				committedAt: '2026-11-13T16:24:02+01:00',
				branches: ['main'],
				retained: false
			}
		],
		truncated: false
	};
}
