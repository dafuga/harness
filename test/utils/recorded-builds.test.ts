import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { VerificationStoreRepository } from '../../src/repositories/VerificationStoreRepository';
import { BuildIdentityService } from '../../src/services/BuildIdentityService';
import { emptyBuildStamp } from '../../src/utils/buildStamp';
import { recordedBuilds } from '../../src/utils/recordedBuilds';
import { recordIntact, sealRecord } from '../../src/utils/sealRecord';
import { VerificationRecordValidator } from '../../src/validators/VerificationRecordValidator';
import { verificationSample } from '../support/verificationSample';

let root: string;
const service = new BuildIdentityService();
const validator = new VerificationRecordValidator();
beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-recorded-builds-'));
});
afterAll(() => rm(root, { recursive: true, force: true }));

/** A compiled server that cannot read its own files: it carries a slot for its identity. */
async function worker(name: string): Promise<string> {
	const directory = join(root, name);
	await mkdir(join(directory, 'assets'), { recursive: true });
	await writeFile(join(directory, '_worker.js'), `export const build = "${emptyBuildStamp()}";\n`);
	await writeFile(join(directory, 'assets/app.js'), `render("${name}");\n`);
	return directory;
}
/** What a run observes of one declared build, as the service reports it. */
const observe = (name: string) => service.declared(root, [{ id: 'worker', directory: name }]);
/** The sample run, sealed with these builds in it. */
function recordWith(builds: Pick<VerificationRecord, 'builds'>): VerificationRecord {
	const draft: Partial<VerificationRecord> = { ...verificationSample(), ...builds };
	delete draft.id;
	return sealRecord(draft as Omit<VerificationRecord, 'id'>);
}
/** Saves the record as a run does and reads it back as every later command does. */
async function kept(record: VerificationRecord, run: string): Promise<VerificationRecord[]> {
	const store = new VerificationStoreRepository(join(root, run));
	await store.save(record, store.directoryFor(record.source.commit, record.startedAt));
	const byId = store.load(record.id)?.record;
	return [...(byId ? [byId] : []), ...store.all().map((stored) => stored.record)];
}

test('a stamped build is recorded by where it is and what its files are, and the record loads', async () => {
	const stamped = await service.stamp(await worker('stamped'));
	const { found, failures } = await observe('stamped');
	expect(failures).toEqual([]);
	const builds = recordedBuilds(found);
	expect(builds).toEqual({
		builds: [{ id: 'worker', directory: 'stamped', buildId: stamped.buildId, files: 2 }]
	});
	const record = recordWith(builds);
	expect(validator.validate(record).errors).toEqual([]);
	expect(recordIntact(record)).toBe(true);
	expect(await kept(record, 'stamped-run')).toEqual([record, record]);
});

test('a build that was never stamped is recorded the same way', async () => {
	const directory = await worker('unstamped');
	const identity = await service.identify(directory);
	const { found } = await observe('unstamped');
	const builds = recordedBuilds(found);
	expect(builds).toEqual({
		builds: [{ id: 'worker', directory: 'unstamped', buildId: identity?.buildId, files: 2 }]
	});
	expect(validator.validate(recordWith(builds)).errors).toEqual([]);
});

test('no declared build leaves the record without builds; none produced leaves them empty', () => {
	expect(recordedBuilds(undefined)).toEqual({});
	expect(recordedBuilds([])).toEqual({ builds: [] });
	expect(recordWith(recordedBuilds(undefined))).not.toHaveProperty('builds');
	expect(validator.validate(recordWith(recordedBuilds([]))).errors).toEqual([]);
});

test('the record schema still refuses a build that carries anything else, and the store does not load it', async () => {
	const stamped = await service.stamp(await worker('leaked'));
	const build = { id: 'worker', directory: 'leaked', buildId: stamped.buildId, files: 2 };
	for (const extra of [{ stamp: stamped.buildId }, { note: 'anything' }]) {
		const record = recordWith({ builds: [{ ...build, ...extra }] });
		const judged = validator.validate(record);
		expect(judged.value).toBeUndefined();
		expect(judged.errors).toHaveLength(1);
		expect(judged.errors[0]).toContain('builds.0');
		expect(judged.errors[0]).toContain(Object.keys(extra)[0]);
		expect(await kept(record, `leaked-${Object.keys(extra)[0]}`)).toEqual([]);
	}
});

test('a stale stamp never reaches a record: the build is refused before it is observed', async () => {
	await service.stamp(await worker('stale'));
	await writeFile(join(root, 'stale/assets/app.js'), 'render("changed after stamping");\n');
	const { found, failures } = await observe('stale');
	expect(failures).toEqual([
		expect.stringMatching(/^build worker carries the stamp of other files/)
	]);
	expect(recordedBuilds(found)).toEqual({ builds: [] });
});
