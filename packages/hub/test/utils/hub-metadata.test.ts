import { expect, test } from 'vitest';
import { hubMetadata } from '../../src/utils/hubMetadata';
import { hubSource } from '../../src/utils/hubSource';
import { hubRecords } from '../../src/utils/hubRecords';
import {
	actor,
	project,
	commit,
	unit,
	unitPath,
	projectionFixture
} from '../support/projectionFixture';

test('metadata bundles use one batch and reuse it across source refs without individual fetches', async () => {
	const f = projectionFixture(),
		calls: unknown[] = [];
	f.source.rawMany = async (_repo, input) => {
		calls.push(input);
		return new Map(input.paths.map((path) => [path, f.files.get(path)!]));
	};
	f.source.raw = async () => {
		throw Error('Unexpected per-file GitHub request');
	};
	const load = (ref: string) =>
		hubSource({ source: f.source, cache: f.cache, actor, project, ref });
	const context = await load('refs/heads/feat/a/b');
	await Promise.all([hubMetadata(context), hubMetadata(context)]);
	expect((await hubRecords(context))[0].id).toBe(unit.id);
	expect((await hubRecords(await load(commit)))[0].id).toBe(unit.id);
	expect(calls).toEqual([{ commit, paths: [unitPath] }]);
});
test('cached metadata bytes remain bound to the selected Git tree', async () => {
	const f = projectionFixture();
	f.source.rawMany = async (_repo, input) =>
		new Map(input.paths.map((path) => [path, new TextEncoder().encode('{}')]));
	const context = await hubSource({
		source: f.source,
		cache: f.cache,
		actor,
		project,
		ref: commit
	});
	await expect(hubRecords(context)).rejects.toThrow();
});
