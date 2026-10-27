import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attach, lfsObjectPath, type NoteLine } from '../../../test/support/historyRepo';
import type { VerifyRepo } from '../../../test/support/verifyRepo';
import { git } from './recorded-evidence-fixture';

/** The most raw bytes one artifact may have: 11 MiB. */
export const limit = 11 * 1024 * 1024;
export const markup = '<!doctype html><html><body><script>alert(1)</script></body></html>';

const html = `if (media === 'html') return Buffer.from('${markup}');\n\tif (media === 'corrupt')`;
const sized =
	"env.FIXTURE_OUTPUT_BYTES ? 'a'.repeat(Number(env.FIXTURE_OUTPUT_BYTES)) : read('src/utils/clock.ts'));";

/** The fixture check with two more switches: markup as a screenshot, and an output of a size. */
function patched(source: string): string {
	const next = source
		.replace("if (media === 'corrupt')", html)
		.replace("read('src/utils/clock.ts'));", sized);
	if (next === source || !next.includes(sized)) throw new Error('The fixture check has changed.');
	return next;
}

/**
 * Two more commits on main, each with its own attached record. `exact` records an output of
 * exactly the limit and screenshots that are markup; `over` records an output one byte larger.
 */
export async function limitRecords(repo: VerifyRepo): Promise<{ exact: string; over: string }> {
	const exact = await repo.change('scripts/fixture.mjs', patched);
	const verified = await repo.verify([], {
		FIXTURE_OUTPUT_BYTES: String(limit),
		FIXTURE_MEDIA: 'html'
	});
	const path = 'src/services/TitleService.ts';
	const expected = await repo.git(['rev-parse', `HEAD:${path}`]);
	const title = verified.record.components.find((unit) => unit.unit === 'service.title');
	if (title?.files.find((file) => file.path === path)?.hash !== expected)
		throw new Error('benchmarked unit service.title must retain its committed source hash');
	await attach(repo);
	const over = await repo.change('src/utils/clock.ts', (source) =>
		source.replace('return value;', 'return value.trim();')
	);
	await repo.verify([], { FIXTURE_OUTPUT_BYTES: String(limit + 1) });
	await attach(repo);
	return { exact, over };
}

/** Other bytes where the media object of a capture is kept: what a damaged disk would leave. */
export const tamperMedia = (root: string, sha256: string) =>
	writeFile(lfsObjectPath(root, sha256), 'not the recorded bytes');

const plumbing = (root: string, args: string[], options: { input?: string; index?: string } = {}) =>
	execFileSync('git', ['-c', 'user.name=Tamper', '-c', 'user.email=t@harness.invalid', ...args], {
		cwd: root,
		encoding: 'utf8',
		input: options.input,
		env: { ...process.env, ...(options.index ? { GIT_INDEX_FILE: options.index } : {}) }
	}).trim();

/**
 * The record of a commit replaced by another one in a new evidence commit, with the note of the
 * commit pointing there: the manifest still states the hash of the record that was sealed.
 */
export function corruptRecord(root: string, commit: string): void {
	const noted = git(root, 'notes', '--ref=harness', 'show', commit).split('\n').filter(Boolean);
	const lines = noted.map((line) => JSON.parse(line) as NoteLine);
	const pointer = lines.find((line) => line.kind === 'verification')?.evidence;
	if (!pointer) throw new Error('The commit has no record to corrupt.');
	const path = `${pointer.path}/record.json`;
	const sealed = JSON.parse(git(root, 'cat-file', 'blob', `${pointer.commit}:${path}`)) as object;
	const forged = JSON.stringify({ ...sealed, failures: ['forged'] });
	const blob = plumbing(root, ['hash-object', '-w', '--stdin'], { input: forged });
	const tip = git(root, 'rev-parse', 'refs/heads/harness-evidence');
	const index = join(root, '.git', 'tamper-index');
	plumbing(root, ['read-tree', tip], { index });
	plumbing(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { index });
	const tree = plumbing(root, ['write-tree'], { index });
	pointer.commit = plumbing(root, ['commit-tree', tree, '-p', tip, '-m', 'forged']);
	plumbing(root, ['update-ref', 'refs/heads/harness-evidence', pointer.commit]);
	const text = `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
	plumbing(root, ['notes', '--ref=harness', 'add', '-f', '-F', '-', commit], { input: text });
}
