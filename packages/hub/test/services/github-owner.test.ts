import { expect, test } from 'vitest';
import { ada, grace } from '../support/authFixture';
import {
	ADA_GITHUB,
	FOREIGN_INSTALLATION,
	FOREIGN_REPOSITORY,
	GRACE_GITHUB,
	OWNER_INSTALLATION,
	READ_ONLY_REPOSITORY,
	SOURCE_REPOSITORY
} from '../support/githubFakeState';
import { failure, githubFixture } from '../support/githubFixture';
import type { GithubFixture } from '../support/githubFixture';

const denied = 'Hub auth repository-denied';
const source = (fixture: GithubFixture) =>
	fixture.github.state.installations[0].repositories.find((repo) => repo.id === SOURCE_REPOSITORY)!;

test('an administrator gets the identity GitHub resolves, installation included', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	expect(await fixture.owner.authorizeRepository(ada, SOURCE_REPOSITORY)).toEqual({
		id: SOURCE_REPOSITORY,
		owner: 'synthetic-org',
		name: 'source',
		private: false,
		installationId: OWNER_INSTALLATION
	});
});

test('an actor without a GitHub connection is refused', async () => {
	const fixture = await githubFixture();
	const attempt = fixture.owner.authorizeRepository(ada, SOURCE_REPOSITORY);
	expect(await failure(attempt)).toBe('Hub auth github-not-connected');
	expect(fixture.github.state.calls).toHaveLength(0);
});

test('read access to a repository is not ownership', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	expect(await failure(fixture.owner.authorizeRepository(ada, READ_ONLY_REPOSITORY))).toBe(denied);
});

test('an installation the user cannot reach proves nothing, whatever id is asked for', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	expect(await failure(fixture.owner.authorizeRepository(ada, FOREIGN_REPOSITORY))).toBe(denied);
	const probed = fixture.github.state.mints.map((mint) => mint.installationId);
	expect(probed).not.toContain(FOREIGN_INSTALLATION);
	expect(await fixture.tokens.resolve(FOREIGN_INSTALLATION, FOREIGN_REPOSITORY)).not.toBeNull();
	await fixture.connect(grace, GRACE_GITHUB);
	expect(await failure(fixture.owner.authorizeRepository(grace, SOURCE_REPOSITORY))).toBe(denied);
	expect(await fixture.owner.authorizeRepository(grace, FOREIGN_REPOSITORY)).toMatchObject({
		installationId: FOREIGN_INSTALLATION
	});
});

test('every call asks GitHub again: a demoted administrator is refused at once', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	await fixture.owner.authorizeRepository(ada, SOURCE_REPOSITORY);
	source(fixture).admins = [];
	source(fixture).readers = [ADA_GITHUB];
	expect(await failure(fixture.owner.authorizeRepository(ada, SOURCE_REPOSITORY))).toBe(denied);
});

test('a repository removed from the installation, or a suspended installation, is refused', async () => {
	const removed = await githubFixture();
	await removed.connect(ada, ADA_GITHUB);
	const [installation] = removed.github.state.installations;
	installation.repositories = installation.repositories.filter(
		(repo) => repo.id !== SOURCE_REPOSITORY
	);
	expect(await failure(removed.owner.authorizeRepository(ada, SOURCE_REPOSITORY))).toBe(denied);
	const suspended = await githubFixture();
	await suspended.connect(ada, ADA_GITHUB);
	suspended.github.state.installations[0].suspended = true;
	expect(await failure(suspended.owner.authorizeRepository(ada, SOURCE_REPOSITORY))).toBe(denied);
	expect(suspended.github.state.mints).toHaveLength(0);
});

test('an installation of some other app is never used as proof', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	fixture.github.state.installations[0].appId = 7;
	expect(await failure(fixture.owner.authorizeRepository(ada, SOURCE_REPOSITORY))).toBe(denied);
	expect(fixture.github.state.mints).toHaveLength(0);
});

test('revoking the app on GitHub ends the proof', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	fixture.github.revoke(ADA_GITHUB);
	expect(await failure(fixture.owner.authorizeRepository(ada, SOURCE_REPOSITORY))).toBe(denied);
});

test('a repository id that is not a positive integer is refused without a GitHub call', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	const before = fixture.github.state.calls.length;
	for (const id of [0, -1, 1.5, Number.NaN]) {
		expect(await failure(fixture.owner.authorizeRepository(ada, id))).toBe(denied);
	}
	expect(fixture.github.state.calls).toHaveLength(before);
});

test('the picker lists only administered repositories and no installation ids', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	const listing = await fixture.owner.repositories(ada);
	expect(listing.truncated).toBe(false);
	expect(listing.repositories).toEqual([
		{ id: 9001, owner: 'synthetic-org', name: 'source', private: false },
		{ id: 9002, owner: 'synthetic-org', name: 'collaboration', private: true }
	]);
	const [installation] = fixture.github.state.installations;
	for (let id = 20000; id < 20320; id++) {
		const extra = { id, owner: 'synthetic-org', name: `r${id}`, private: true };
		installation.repositories.push({ ...extra, admins: [ADA_GITHUB], readers: [] });
	}
	const long = await fixture.owner.repositories(ada);
	expect(long.truncated).toBe(true);
	// Three pages of 100 are read; one of those 300 rows is the read-only repository.
	expect(long.repositories).toHaveLength(299);
});

test('an outage is an honest failure, not a denial and not provider text', async () => {
	const fixture = await githubFixture();
	await fixture.connect(ada, ADA_GITHUB);
	fixture.github.state.outage = true;
	const message = await failure(fixture.owner.authorizeRepository(ada, SOURCE_REPOSITORY));
	expect(message).toBe('Hub auth github-unavailable');
});
