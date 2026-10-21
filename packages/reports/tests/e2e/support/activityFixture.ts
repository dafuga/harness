import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fixtures } from './fixtures';

/**
 * Gives the fixture application a history to show: two components, three loops of two types,
 * a change with its reason noted, work in its second checkout that is not committed, and agents
 * that registered through the public command: one working, one quiet, one finished, and one of
 * another application. It is made once for a run, with the commands a project itself uses.
 */
export interface ActivityFixture {
	commits: { first: string; second: string };
}
const cli = resolve('../../src/index.ts');
const site = fixtures.site('alpha-project');
const checkout = fixtures.site('alpha-checkout');
const foreign = fixtures.site('beta-project');
const marker = join(site, '.git', 'activity-fixture.json');
const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
const git = (cwd: string, args: string[]) =>
	execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], {
		cwd,
		encoding: 'utf8'
	}).trim();
const reason = (behavior: string) => [
	...['--behavior', behavior, '--simplification', 'Nothing simpler was found.'],
	...['--simplification-outcome', 'not-improved', '--performance', 'No hot path is touched.'],
	...['--performance-outcome', 'not-applicable']
];

/** The fixture uses supported public commands; a rejected command must fail setup. */
function harness(cwd: string, args: string[]): string {
	return execFileSync('bun', [cli, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
}

function write(cwd: string, path: string, contents: string): void {
	mkdirSync(dirname(join(cwd, path)), { recursive: true });
	writeFileSync(join(cwd, path), contents);
}

function commit(message: string): string {
	git(site, ['add', '-A']);
	git(site, ['commit', '-q', '-m', message]);
	return git(site, ['rev-parse', 'HEAD']);
}

/** A completed planning feature uses the real audit; the two coding loops remain open. */
function loops(): void {
	const plan = 'specification/features/planned/cart-release.md';
	write(
		site,
		plan,
		[
			'# Cart release plan',
			'## Overview',
			'Plan the cart release using the existing price and cart operations.',
			'## Acceptance Criteria',
			'- Check cart totals and rounding before release approval.',
			'## Dependencies',
			'Use the current price helper and CartService contracts.',
			'## Verification',
			'Run unit tests for prices and integration tests for cart totals.',
			'## Performance',
			'Profile representative cart workloads for latency and process memory through Harness.'
		].join('\n')
	);
	for (const [name, from] of [
		['ship-cart', 'feature'],
		['fix-rounding', 'bug-fix'],
		['more-cart', 'feature']
	]) {
		const completion = name === 'ship-cart' ? ['--kind', 'planning', '--plan', plan] : [];
		harness(site, [
			'loop',
			'create',
			name,
			'--from',
			from,
			'--goal',
			name === 'ship-cart' ? 'Plan cart release' : `Goal of ${name}`,
			...completion
		]);
	}
	commit('chore: record cart release plan');
	for (const step of ['spec', 'implement', 'test', 'verify'])
		harness(site, [
			'loop',
			'complete',
			'ship-cart',
			step,
			'--evidence',
			'Cart release plan reviewed.'
		]);
}

function history(): ActivityFixture['commits'] {
	write(site, '.gitignore', '.cache/\n');
	write(
		site,
		'src/utils/price.ts',
		'export function price(n: number): number {\n\treturn n * 2;\n}\n'
	);
	const cart =
		"import { price } from '../utils/price';\n\nexport class CartService {\n\trun(n: number): number {\n\t\treturn price(n);\n\t}\n}\n";
	write(site, 'src/services/CartService.ts', cart);
	harness(site, ['units', 'index', '--write']);
	const first = commit('feat: prices and a cart');
	loops();
	write(
		site,
		'src/utils/price.ts',
		'export function price(n: number): number {\n\treturn n * 3;\n}\n'
	);
	harness(site, ['units', 'index', '--write']);
	harness(site, ['explain', 'add', '--all', ...reason('Prices are tripled.')]);
	const second = commit('feat: triple the price');
	harness(site, ['history', 'reasons']);
	return { first, second };
}

function agents(): void {
	const register = (cwd: string, args: string[]) =>
		harness(cwd, ['activity', 'register', '--json', ...args]);
	const stated = ['--provider', 'anthropic', '--model', 'claude-opus-5-5'];
	const work = ['--task', 'Cart totals', '--loop', 'more-cart', '--units', 'service.cart'];
	register(checkout, ['--label', 'Opus session', ...stated, ...work]);
	register(site, ['--label', 'Quiet helper', '--ttl', '1']);
	const done = register(site, ['--label', 'Finisher']);
	const id = done ? (JSON.parse(done) as { id: string }).id : 'none';
	harness(site, ['activity', 'finish', id, '--outcome', 'Handed over']);
	register(foreign, ['--label', 'Foreign agent', '--model', 'foreign-model']);
}

export function activityFixture(): ActivityFixture {
	if (existsSync(marker)) return JSON.parse(readFileSync(marker, 'utf8')) as ActivityFixture;
	const commits = history();
	// The second checkout follows, then holds work that is not committed.
	git(checkout, ['merge', '-q', '--ff-only', 'main']);
	write(checkout, 'src/services/CartService.ts', '// draft\n');
	write(checkout, 'draft-notes.txt', 'draft\n');
	agents();
	const made = { commits };
	writeFileSync(marker, JSON.stringify(made));
	return made;
}
