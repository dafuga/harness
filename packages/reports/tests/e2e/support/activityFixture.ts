import type { ActivityFixture } from './activityFixture.types';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fixtures } from './fixtures';
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

/** One Harness command in a checkout. A command this product does not have yet returns nothing. */
function harness(cwd: string, args: string[]): string | undefined {
	try {
		return execFileSync('bun', [cli, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
	} catch {
		return undefined;
	}
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
	for (const [name, from] of [
		['ship-cart', 'feature'],
		['fix-rounding', 'bug-fix'],
		['more-cart', 'feature']
	]) {
		harness(site, ['loop', 'create', name, '--from', from, '--goal', `Goal of ${name}`]);
	}
	for (const step of ['spec', 'implement', 'test', 'verify']) {
		harness(site, ['loop', 'complete', 'ship-cart', step, '--evidence', 'Done.']);
	}
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

export type { ActivityFixture } from './activityFixture.types';
