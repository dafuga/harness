import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const workflow = readFileSync('.github/workflows/harness-verify.yml', 'utf8');
/** The text of one job: from its key to the next job, or to the end of the file. */
function job(name: string): string {
	const start = workflow.indexOf(`\n  ${name}:\n`);
	const next = workflow.slice(start + 1).search(/\n {2}[\w-]+:\n/);
	return start < 0 ? '' : workflow.slice(start, next < 0 ? undefined : start + 1 + next);
}
const check = job('check');
const verify = job('verify');
const xcode = '/Applications/Xcode_26.3.app/Contents/Developer';
/** Where a line of the verify job stands, to compare the order of its steps. */
const at = (text: string): number => verify.indexOf(text);

test('the full check stays on Linux with its display and dependency setup', () => {
	expect(check).toContain('name: Full check\n    runs-on: ubuntu-latest');
	expect(check).toMatch(/\n {4}timeout-minutes: 120\n/);
	expect(check).toContain('@playwright/test/cli.js install --with-deps chromium');
	expect(check).toContain('sudo apt-get install --yes git-lfs xauth libgtk-3-0t64 ffmpeg');
	expect(check).toContain('run: xvfb-run -a bun run check');
	expect(check).not.toMatch(/macos|xcode|DEVELOPER_DIR/i);
});

test('the exact commit is verified on Apple silicon macOS, where native evidence exists', () => {
	expect(verify).toContain('name: Verify the exact commit\n');
	expect(verify).toMatch(/\n {4}runs-on: macos-15\n/);
	expect(verify).toContain('test "$(uname -m)" = arm64');
	expect(verify).not.toMatch(/ubuntu|xvfb|apt-get|--with-deps/);
	expect(verify).toMatch(/\n {4}timeout-minutes: 180\n/);
});

test('one Xcode is pinned, selected for every tool that asks, and logged before anything runs', () => {
	expect(verify).toMatch(new RegExp(`\\n {4}env:\\n {6}DEVELOPER_DIR: ${xcode}\\n`));
	expect([...verify.matchAll(/Xcode_[\d.]+\.app/g)].map((found) => found[0])).toEqual([
		'Xcode_26.3.app'
	]);
	const selection = [
		'test -d "$DEVELOPER_DIR"',
		'sudo xcode-select --switch "$DEVELOPER_DIR"',
		'test "$(xcode-select -p)" = "$DEVELOPER_DIR"',
		'echo "DEVELOPER_DIR=$DEVELOPER_DIR"',
		'xcodebuild -version | grep -Fx "Xcode 26.3"',
		'xcodebuild -showsdks',
		'xcrun --sdk iphonesimulator --show-sdk-version'
	];
	for (const line of selection) expect(verify).toContain(`\n          ${line}\n`);
	expect(selection.map(at)).toEqual([...selection.map(at)].sort((left, right) => left - right));
	expect(at(selection[0])).toBeLessThan(at('bun install --frozen-lockfile'));
	expect(at(selection[0])).toBeLessThan(at('verify run --commit'));
	expect(workflow).not.toMatch(/^\s+(HOME|CODEX_HOME):/m);
});

test('the macOS job keeps every obligation of the verification', () => {
	const checkout = verify.slice(at('actions/checkout@'), at('- name:'));
	expect(checkout).toMatch(/actions\/checkout@[0-9a-f]{40} /);
	expect(checkout).toContain('ref: ${{ env.COMMIT }}');
	expect(checkout).toContain('fetch-depth: 0');
	expect(checkout).toContain('persist-credentials: false');
	for (const kept of [
		'run: npm install --global bun@1.2.18',
		'run: rustup show',
		'run: bun install --frozen-lockfile',
		'run: node node_modules/@playwright/test/cli.js install chromium',
		'reportlab==4.4.9 Pillow==12.3.0 pypdf==6.10.0',
		'echo "PROJECT_REPORTS_PYTHON=$RUNNER_TEMP/harness-pdf/bin/python" >> "$GITHUB_ENV"',
		'run: bun run dev -- verify run --commit "$COMMIT"',
		'name: harness-record',
		'path: .cache/harness/verifications/${{ env.COMMIT }}',
		'if-no-files-found: error',
		"if: steps.verify.outcome != 'success'"
	]) {
		expect(verify).toContain(`${kept}\n`);
	}
	expect(verify).toMatch(/brew install [^\n]*git-lfs[^\n]* ffmpeg\n/);
	expect(verify).toContain('git lfs install --local\n');
	expect(verify).toMatch(/id: verify\n {8}continue-on-error: true\n/);
	expect(verify.trimEnd().endsWith('run: exit 1')).toBe(true);
});

test('existing evidence is read with a credential that is removed before the code runs', () => {
	const set = at('git config --local http.https://github.com/.extraheader "$header"');
	const read = at('bun run dev -- history fetch origin');
	const unset = at('git config --local --unset-all http.https://github.com/.extraheader');
	expect(set).toBeGreaterThan(0);
	expect([set, read, unset]).toEqual([set, read, unset].sort((left, right) => left - right));
	expect(unset).toBeLessThan(at('verify run --commit'));
	expect(workflow).not.toMatch(/echo[^\n]*(\$header|GH_TOKEN|AUTHORIZATION)|set -x|printenv/);
	expect(workflow.match(/GH_TOKEN/g)).toHaveLength(2);
});

test('nothing is relaxed, mapped to a deployment or added as another workflow', () => {
	expect(readdirSync('.github/workflows').sort()).toEqual([
		'harness-evidence.yml',
		'harness-verify.yml'
	]);
	expect(workflow.match(/continue-on-error/g)).toHaveLength(1);
	expect(workflow).not.toMatch(/\|\| true|environment:|deploy|secrets\.|SKIP|allow[-_]failure/i);
	expect(workflow).not.toMatch(/budget (establish|approve)|HARNESS_PROFILE_LABEL/);
	expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
	expect(workflow.match(/^ {2}[\w-]+:\n {4}name:/gm)).toHaveLength(2);
});
