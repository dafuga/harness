import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ProjectActivity from '../../src/components/project-activity/ProjectActivity.svelte';

function sha(letter: string): string {
	return letter.repeat(40);
}
const activity = {
	schemaVersion: 1,
	kind: 'live',
	repository: { name: 'alpha-project', branch: 'main', head: sha('a') },
	asOf: { commit: sha('a'), committedAt: '2026-10-11T09:00:00.000Z' },
	loops: {
		total: 3,
		types: [
			{
				template: 'feature',
				loops: 2,
				complete: 1,
				open: 1,
				lastUsedAt: '2026-10-11T08:00:00.000Z',
				names: ['ship-titles', 'more-titles']
			},
			{
				template: 'bug-fix',
				loops: 1,
				complete: 0,
				open: 1,
				lastUsedAt: '2026-10-10T08:00:00.000Z',
				names: ['fix-case']
			}
		]
	},
	work: [
		{
			commit: sha('a'),
			subject: 'feat: upper-case titles',
			author: 'Fixture',
			committedAt: '2026-10-11T09:00:00.000Z',
			branches: ['feature/kept#1'],
			units: ['function.slugify'],
			reasons: [{ unit: 'function.slugify', behavior: 'Titles are upper case.' }],
			reasonCount: 1,
			files: 1
		},
		{
			commit: sha('b'),
			subject: 'chore: nothing explained',
			author: 'Fixture',
			committedAt: '2026-10-10T09:00:00.000Z',
			branches: [],
			units: [],
			reasons: [],
			reasonCount: 0,
			files: 0
		}
	],
	files: [
		{
			path: 'src/utils/slugify.ts',
			status: 'modified',
			commit: sha('a'),
			committedAt: '2026-10-11T09:00:00.000Z',
			units: ['function.slugify']
		},
		{
			path: 'README.md',
			status: 'added',
			commit: sha('b'),
			committedAt: '2026-10-10T09:00:00.000Z',
			units: []
		}
	]
};
const entry = (label: string, state: string, more: object = {}) => ({
	id: label.toLowerCase().replaceAll(' ', '-'),
	label,
	provider: null,
	model: null,
	worktree: 'alpha-checkout',
	branch: 'checkout',
	task: null,
	loop: null,
	units: [],
	unknownUnits: [],
	registeredAt: '2026-10-11T09:00:00.000Z',
	heartbeatAt: '2026-10-11T09:30:00.000Z',
	state,
	detail: `${label} detail`,
	...more
});
const live = {
	sampledAt: '2026-10-11T09:31:00.000Z',
	worktrees: [
		{
			name: 'alpha-project',
			branch: 'main',
			head: sha('a'),
			primary: true,
			changes: [],
			truncated: false
		},
		{
			name: 'alpha-checkout',
			branch: 'checkout',
			head: sha('a'),
			primary: false,
			changes: [
				{ path: 'src/services/TitleService.ts', status: 'modified', units: ['service.title'] }
			],
			truncated: false
		}
	],
	agents: {
		tracking: 'available',
		working: 1,
		unreadable: 0,
		roster: [
			entry('Opus session', 'working', {
				provider: 'anthropic',
				model: 'claude-opus-5-5',
				task: 'Project analytics',
				loop: 'project-activity',
				units: ['service.title', 'service.nothing'],
				unknownUnits: ['service.nothing']
			}),
			entry('Quiet helper', 'stale'),
			entry('Finisher', 'completed', { outcome: 'Handed over' })
		]
	}
};
// The fixtures are plain data, as a page receives them; the component's own types are stricter.
const body = (props: object) =>
	render(ProjectActivity, { props: { activity, live, base: '/harness', ...props } as never }).body;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/** The text of one section; a list inside it may carry the same label as the section. */
const section = (html: string, label: string) => {
	const marker = `aria-label="${label}"`;
	return text(html.split(marker).slice(1).join(marker).split('</section>')[0]);
};

test('the number of working agents is what registered agents say, and each is shown as it is', () => {
	const html = body({});
	const agents = section(html, 'Working agents');
	expect(html).toMatch(/data-testid="agents-working"[^>]*>\s*1\s*</);
	expect(agents).toContain('1 registered agent is working');
	expect(agents).toContain('Opus session');
	expect(agents).toContain('anthropic · claude-opus-5-5');
	expect(agents).toContain('alpha-checkout · branch checkout');
	expect(agents).toContain('Project analytics');
	expect(agents).toContain('project-activity');
	expect(agents).toMatch(/service\.nothing\s+not in the registry/);
	// What an owner did not state is said to be unstated, and a quiet agent is not working.
	expect(agents).toContain('Model not stated');
	expect(agents).toMatch(/Quiet helper.*Stale/);
	expect(agents).toMatch(/Finisher.*Finished.*Handed over/);
});

test('not knowing who is working is said, and never shown as zero', () => {
	const unused = {
		...live,
		agents: { tracking: 'never-used', working: null, unreadable: 0, roster: [] }
	};
	const never = body({ live: unused });
	expect(never).toMatch(/data-testid="agents-working"[^>]*>\s*Unknown\s*</);
	expect(section(never, 'Working agents')).toContain('No agent has registered in this repository');
	expect(section(never, 'Working agents')).toContain('harness activity register');
	// A recorded history has no live state at all: nothing is counted and nothing is empty.
	const recorded = body({ activity: { ...activity, kind: 'recorded' }, live: null });
	expect(recorded).not.toContain('data-testid="agents-working"');
	expect(section(recorded, 'Working agents')).toContain('not part of a recorded history');
	expect(section(recorded, 'Recently changed files')).toContain(
		'Uncommitted changes are not part of a recorded history'
	);
	const damaged = { ...live, agents: { ...live.agents, unreadable: 2 } };
	expect(section(body({ live: damaged }), 'Working agents')).toContain(
		'2 registrations could not be read'
	);
});

test('loop types, recent work and changed files are shown with their outcomes, links and components', () => {
	const html = body({});
	const loops = section(html, 'Loop types');
	expect(loops).toMatch(/feature\s+2 loops · 1 complete · 1 open/);
	expect(loops).toMatch(/bug-fix\s+1 loop · 0 complete · 1 open/);
	const work = section(html, 'Recent work');
	expect(work).toContain('feat: upper-case titles');
	expect(work).toContain('Titles are upper case.');
	expect(work).toContain('No reason is noted on this commit');
	// A commit links to its own page of the console; a branch name is encoded, its slashes kept.
	expect(html).toContain(`href="/harness/branch/feature/kept%231/commit/${sha('a')}/history"`);
	expect(html).toContain(`href="/harness/commit/${sha('b')}/history"`);
	const files = section(html, 'Recently changed files');
	expect(files).toMatch(/src\/utils\/slugify\.ts.*function\.slugify/);
	expect(files).toMatch(/README\.md.*no component/);
	// Committed and uncommitted are two lists; a checkout without changes says so.
	expect(html.indexOf('aria-label="Committed files"')).toBeGreaterThan(-1);
	expect(html.split('aria-label="Uncommitted files"')[1]).toContain('src/services/TitleService.ts');
	expect(files).toContain('alpha-checkout · branch checkout');
	const clean = { ...live, worktrees: [live.worktrees[0]] };
	expect(section(body({ live: clean }), 'Recently changed files')).toContain(
		'No uncommitted change in any checkout of this repository'
	);
});

test('empty history is said, not left blank', () => {
	const empty = { ...activity, loops: { total: 0, types: [] }, work: [], files: [] };
	const html = body({ activity: empty });
	expect(section(html, 'Loop types')).toContain('No loop is tracked in this repository');
	expect(section(html, 'Recent work')).toContain('No commit');
	expect(section(html, 'Recently changed files')).toContain('No committed change');
});
