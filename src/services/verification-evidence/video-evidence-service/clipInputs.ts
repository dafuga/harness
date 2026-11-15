// @harness-uid u_nfctcgnv7g
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import type { VideoManifest } from '../../../utils/verification-evidence/videoClipSchema.types';
import type { VideoOwner } from './clipInputs.types';

/** Hash each slot's declared inputs and full registered owner/dependency closure. */
export function clipInputHash(
	root: string,
	manifest: VideoManifest,
	clip: VideoManifest['clips'][number],
	viewport: string
): string {
	const units = readOwners(root),
		files = new Set([...clip.inputs, clip.script.path, clip.fixture]);
	const contracts = new Map<string, VideoOwner>();
	const pending = [clip.unit];
	while (pending.length) {
		const id = pending.pop()!;
		if (contracts.has(id)) continue;
		const owner = units.get(id);
		if (owner?.status !== 'active') throw new ExpectedCliError(`Missing active video owner ${id}`);
		contracts.set(id, owner);
		for (const path of owner.owns.source) files.add(path);
		pending.push(...owner.dependencies.map((dependency) => dependency.unit));
	}
	for (const path of ['bun.lock', 'yarn.lock', 'package-lock.json', 'harness.verify.json'])
		if (existsSync(join(root, path))) files.add(path);
	const inputs = [...files].sort().map((path) => [path, hash(readBound(root, path))]);
	const graphs = manifest.graphs
		.filter((graph) => graph.clips.includes(clip.id))
		.map((graph) => ({
			unit: graph.unit,
			states: graph.states.filter((state) => clip.states.includes(state.id)),
			edges: graph.edges.filter((edge) => clip.edges.includes(edge.id))
		}));
	const tool = spawnSync('ffmpeg', ['-version'], {
		timeout: 5000,
		maxBuffer: 32_768,
		encoding: 'utf8'
	});
	if (tool.status !== 0) throw new ExpectedCliError('Missing ffmpeg recording toolchain');
	return hash(
		stableJson({
			clip,
			viewport: manifest.viewports.find((item) => item.id === viewport),
			inputs,
			graphs,
			contracts: [...contracts].sort(([a], [b]) => a.localeCompare(b)),
			recipe: [
				'playwright-chromium',
				'silent-h264-yuv420p-faststart-v1',
				tool.stdout,
				process.platform,
				process.arch
			]
		})
	);
}

function readOwners(root: string): Map<string, VideoOwner> {
	const directory = join(root, 'specification/units');
	return new Map(
		readdirSync(directory)
			.filter((file) => file.endsWith('.json'))
			.map((file) => {
				const unit = JSON.parse(readFileSync(join(directory, file), 'utf8')) as VideoOwner;
				return [unit.id, unit];
			})
	);
}

function readBound(root: string, path: string): Buffer {
	const absolute = join(root, path);
	if (!existsSync(absolute)) throw new ExpectedCliError(`Missing video input ${path}`);
	const resolved = relative(realpathSync(root), realpathSync(absolute));
	if (resolved === '..' || resolved.startsWith(`..${sep}`))
		throw new ExpectedCliError(`Video input escapes source root: ${path}`);
	return readFileSync(absolute);
}

function hash(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}
