import * as fs from 'node:fs/promises';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';
import { ModuleTaskSandboxAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter';
import type { SandboxProcess } from './module-task-sandbox.test.types';
import {
	flagSet,
	makeFixture,
	prepare,
	runChild,
	unsafeGrantError
} from './module-task-sandbox.test.fixtures';

const nativeTest = test.skipIf(process.platform !== 'darwin');
nativeTest('enforces exact reads and writes in a real child', async () => {
	const fixture = await makeFixture();
	let config: SandboxProcess | undefined;
	try {
		await fs.symlink(fixture.paths.outside, fixture.paths.link);
		config = await prepare(
			fixture,
			['src/[branch].ts', 'bunfig.toml', 'bunfig-preload.js'],
			[fixture.paths.rulesDirectory]
		);
		const hostCwd = await fs.realpath(config.cwd);
		expect(hostCwd).not.toBe(await fs.realpath(fixture.cwd));
		expect(relative(fixture.cwd, hostCwd)).toMatch(/^\.\.(?:\/|$)/);
		expect((await fs.stat(hostCwd)).mode & 0o077).toBe(0);
		const child = await runChild(config);
		expect(child.code, child.stderr).toBe(0);
		const checks = JSON.parse(child.stdout) as Record<string, boolean>;
		const outsideAfter = await fs.readFile(fixture.paths.outside, 'utf8');
		expect(`${checks.scratchHardlinkCreated}:${checks.scratchHardlinkWrite}:${outsideAfter}`).toBe(
			'false:false:outside-original'
		);
		expect(checks).toMatchObject({
			...flagSet(
				true,
				'snapshotRead assignedWrite scratchWrite sandboxedCwdMatches bunfigPreloadRan bunfigWriteBlocked rulesDirectoryListed allowedRuleRead'
			),
			...flagSet(
				false,
				'siblingWrite foreignSourceRead foreignTestRead gitRead commonGitRead appSourceRead foreignModify foreignCreate foreignDelete foreignRename symlinkEscape snapshotWrite outsideWrite scratchHardlinkWrite scratchHardlinkCreated unsetEnvironmentWrite fileToDirectoryEscape siblingMdcRead foreignRuleRead rulesDirectoryWrite allowedRuleWrite siblingMdcWrite foreignRuleWrite'
			)
		});
		expect(await fs.readFile(join(fixture.scratch, 'child.txt'), 'utf8')).toBe('scratch');
		expect(await fs.readFile(fixture.snapshot, 'utf8')).toBe('{"contract":"read-only"}');
		expect(await fs.readFile(fixture.paths.source, 'utf8')).toBe('foreign-source');
		expect(await fs.readFile(fixture.paths.test, 'utf8')).toBe('foreign-test');
		expect(await fs.readFile(fixture.paths.link, 'utf8')).toBe('outside-original');
		expect(await fs.readFile(fixture.paths.rulesFile, 'utf8')).toBe('approved synthetic policy\n');
		expect(await fs.readFile(fixture.paths.siblingMdc, 'utf8')).toBe('sibling metadata');
		expect(await fs.readFile(fixture.paths.foreignRule, 'utf8')).toBe('foreign policy');
		expect((await fs.readdir(fixture.paths.rulesDirectory)).sort()).toEqual([
			'approved.rules',
			'foreign.rules',
			'sibling.mdc'
		]);
		await expect(fs.readFile(fixture.paths.escape)).rejects.toThrow();
	} finally {
		await config?.cleanup();
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});

nativeTest('rejects unsafe grant paths before returning a process', async () => {
	const fixture = await makeFixture();
	try {
		await fs.symlink(fixture.paths.outside, fixture.paths.link);
		await fs.link(fixture.paths.outside, fixture.paths.hardlink);
		for (const files of [
			['../outside-sentinel.txt'],
			[fixture.paths.assigned],
			['src/escape-link.ts'],
			['src/hardlink.ts'],
			['src/directory.ts']
		]) {
			await expect(prepare(fixture, files)).rejects.toThrow(unsafeGrantError);
		}
		await fs.link(fixture.paths.outside, fixture.paths.scratchHardlink);
		const foreign = await fs.stat(fixture.paths.outside);
		const scratchAlias = await fs.stat(fixture.paths.scratchHardlink);
		expect([scratchAlias.dev, scratchAlias.ino]).toEqual([foreign.dev, foreign.ino]);
		await expect(prepare(fixture)).rejects.toThrow(unsafeGrantError);
	} finally {
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});

test.skipIf(process.platform === 'darwin')('fails closed with a platform diagnostic', async () => {
	const fixture = await makeFixture();
	try {
		await expect(prepare(fixture)).rejects.toThrow(/sandbox|unsupported|unavailable|SRT/i);
	} finally {
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});

test('ModuleTaskSandboxAdapter connects', () => {
	expect(new ModuleTaskSandboxAdapter()).toBeInstanceOf(ModuleTaskSandboxAdapter);
});
