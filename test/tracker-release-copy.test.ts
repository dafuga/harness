import { appendFileSync, existsSync, statSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { releaseCopyFixture } from './support/release-copy/fixture';

let fixture: Awaited<ReturnType<typeof releaseCopyFixture>>;
afterEach(() => fixture.dispose());
const limit = 60_000;

test(
	'a receiver left by a dropped copy never changes the published release',
	async () => {
		fixture = await releaseCopyFixture();
		fixture.dropNextConnection();
		const result = fixture.run('copy', fixture.releaseDir('local'), 'mb2');
		expect(result.status, result.stderr).toBe(0);
		const leftAfterPublish = fixture.receivers();
		await fixture.closeDroppedConnection();
		expect(statSync(join(fixture.releaseDir('mb2'), 'harness')).size).toBe(
			statSync(join(fixture.releaseDir('local'), 'harness')).size
		);
		expect(fixture.intact('mb2')).toBe(true);
		expect(leftAfterPublish, 'receivers still running when the release went live').toEqual([]);
	},
	limit
);

test(
	'each attempt copies into a fresh directory without keeping partial files',
	async () => {
		fixture = await releaseCopyFixture();
		fixture.dropNextConnection();
		expect(fixture.run('copy', fixture.releaseDir('local'), 'mb2').status).toBe(0);
		const commands = fixture.receiverCommands();
		expect(commands).toHaveLength(2);
		expect(new Set(commands.map((command) => command.split(' ').at(-1))).size).toBe(2);
		for (const command of commands) expect(command).not.toContain('--partial');
		expect(fixture.stagingDirs('mb2')).toEqual([]);
	},
	limit
);

test(
	'a receiver the process sweep cannot see still cannot reach the live release',
	async () => {
		fixture = await releaseCopyFixture();
		fixture.hostTool('mb2', 'ps', '#!/bin/sh\nexit 0\n');
		fixture.dropNextConnection();
		const result = fixture.run('copy', fixture.releaseDir('local'), 'mb2');
		expect(result.status, result.stderr).toBe(0);
		await fixture.closeDroppedConnection();
		expect(fixture.intact('mb2')).toBe(true);
	},
	limit
);

test(
	'nothing is published while a receiver cannot be stopped',
	async () => {
		fixture = await releaseCopyFixture();
		const stuck = `999999 rsync --server . .local/state/tracker/harness-releases/.copy-${fixture.id}.stuck/`;
		fixture.hostTool('mb2', 'ps', `#!/bin/sh\necho '${stuck}'\n`);
		const result = fixture.run('copy', fixture.releaseDir('local'), 'mb2');
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('999999');
		expect(existsSync(fixture.releaseDir('mb2'))).toBe(false);
	},
	limit
);

test(
	'the soak check verifies this computer and every host, and names each failure',
	async () => {
		fixture = await releaseCopyFixture(['mb2', 'box']);
		for (const host of ['mb2', 'box'])
			expect(fixture.run('copy', fixture.releaseDir('local'), host).status).toBe(0);
		const good = fixture.run('soak', fixture.id, 'mb2', 'box');
		expect(good.status, good.stderr).toBe(0);
		for (const host of ['this computer', 'mb2', 'box']) expect(good.stdout).toContain(`OK ${host}`);

		truncateSync(join(fixture.releaseDir('mb2'), 'harness'), 1_000);
		const truncated = fixture.run('soak', fixture.id, 'mb2', 'box');
		expect(truncated.status).not.toBe(0);
		expect(truncated.stdout).toContain('FAILED mb2');
		expect(truncated.stdout).toContain('OK box');

		appendFileSync(join(fixture.releaseDir('local'), 'BUILD_COMMIT'), 'changed');
		const local = fixture.run('soak', fixture.id, 'box', 'unreachable');
		expect(local.status).not.toBe(0);
		expect(local.stdout).toContain('FAILED this computer');
		expect(local.stdout).toContain('FAILED unreachable');
	},
	limit
);

test(
	'the soak check fails while a receiver for the release is still running',
	async () => {
		fixture = await releaseCopyFixture();
		expect(fixture.run('copy', fixture.releaseDir('local'), 'mb2').status).toBe(0);
		const orphan = `999999 rsync --server . .local/state/tracker/harness-releases/.copy-${fixture.id}.old/`;
		fixture.hostTool('mb2', 'ps', `#!/bin/sh\necho '${orphan}'\n`);
		const result = fixture.run('soak', fixture.id, 'mb2');
		expect(result.status).not.toBe(0);
		expect(result.stdout).toContain('FAILED mb2');
	},
	limit
);
