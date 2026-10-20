import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { mkdtemp, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { CheckpointImageRepository } from '../../src/repositories/CheckpointImageRepository';
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
	'base64'
);
test('checkpoint assets persist by content hash, reload and read from Git history', async () => {
	const root = await mkdtemp(join(tmpdir(), 'checkpoint-image-'));
	const repo = new CheckpointImageRepository(root);
	const path = await repo.save(png);
	expect(path).toMatch(/^static\/game\/checkpoints\/[a-f0-9]{64}\.png$/);
	expect(await repo.read(path)).toBe('data:image/png;base64,' + png.toString('base64'));
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
	git('init');
	git('add', '.');
	git(
		'-c',
		'user.name=Fixture',
		'-c',
		'user.email=fixture@example.invalid',
		'-c',
		'commit.gpgsign=false',
		'commit',
		'-m',
		'feat: checkpoint'
	);
	expect(await repo.read(path, git('rev-parse', 'HEAD'))).toContain(png.toString('base64'));
	await expect(repo.read('../.env.local')).rejects.toThrow('path');
	const outside = await mkdtemp(join(tmpdir(), 'checkpoint-outside-'));
	const hostile = await mkdtemp(join(tmpdir(), 'checkpoint-symlink-'));
	await mkdir(join(hostile, 'static'));
	await symlink(outside, join(hostile, 'static', 'game'));
	await expect(new CheckpointImageRepository(hostile).save(png)).rejects.toThrow('directory');
});
