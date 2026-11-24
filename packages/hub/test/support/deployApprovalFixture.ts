import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { deployApprovalPath } from '../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import { createD1AuthStore } from '../../src/lib/verification-evidence/server/auth/auth';
import { serveDeployApprovals } from '../../src/routes/(accounts-access)/api/deploy-approvals/serveDeployApprovals';
import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { ORIGIN, SECRET } from './authFixture';
import { RequestSessionService } from '../../src/lib/verification-evidence/server/auth/request-session-service/RequestSessionService';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import { SessionRepository } from '../../src/repositories/projects-sessions/SessionRepository';
import { OWNER, OTHER } from './trackerOverviewFixture';

const migrations = [
	'0001-auth-ephemeral-state.sql',
	'0006-account-devices.sql',
	'0007-browser-session-devices.sql',
	'0008-deploy-approvals.sql'
];

export async function deployApprovalFixture() {
	const worker = new Miniflare({
		cf: false,
		workers: [
			{
				config: {
					name: 'deploy-approval-fixture',
					compatibilityDate: '2026-10-12',
					manifest: {
						mainModule: 'index.js',
						modules: {
							'index.js': {
								type: 'esm',
								contents: 'export default { fetch() { return new Response("ok"); } }'
							}
						}
					},
					env: { DB: { type: 'd1', name: 'deploy-approval-fixture-db' } }
				}
			}
		]
	});
	try {
		const db = (await worker.getD1Database(
			'DB',
			'deploy-approval-fixture'
		)) as unknown as D1Database;
		for (const name of migrations) {
			const migration = readFileSync(
				new URL('../../db/migrations/' + name, import.meta.url),
				'utf8'
			);
			for (const sql of migration
				.replaceAll(/^--.*$/gm, '')
				.split(';')
				.map((value) => value.trim())
				.filter(Boolean))
				await db.prepare(sql).run();
		}
		return await approvalRequests(db, () => worker.dispose());
	} catch (error) {
		await worker.dispose();
		throw error;
	}
}

async function approvalRequests(db: D1Database, close: () => Promise<void>) {
	const store = createD1AuthStore(db).sessions;
	const url = ORIGIN + deployApprovalPath;
	const now = Date.now();
	let elapsed = 0;
	const repository = new SessionRepository({
		store,
		secrets: authSecrets(SECRET),
		now: () => Date.now() + elapsed
	});
	const sessions = new RequestSessionService({ sessions: repository, origin: ORIGIN });
	const key = randomBytes(32).toString('base64url');
	let runnerGrants = JSON.stringify({
		'fixture:preprod': createHash('sha256').update(key).digest('hex')
	});
	const owner = await repository.issue({
		kind: 'native',
		actor: OWNER,
		resource: 'projects',
		parentHash: null
	});
	const browser = await repository.issue({
		kind: 'browser',
		actor: OWNER,
		resource: 'projects',
		parentHash: null
	});
	const native = async (actor = OWNER, resource = 'projects') =>
		'Bearer ' +
		(await repository.issue({ kind: 'native', actor, resource, parentHash: null })).credential;
	const serve = (request: Request) =>
		serveDeployApprovals(request, {
			owner: OWNER.id,
			db,
			sessions,
			runnerGrants,
			now: Date.now() + elapsed
		});
	return {
		url,
		now,
		key,
		serve,
		close,
		advance: (ms: number) => {
			elapsed += ms;
		},
		withdrawRunner: () => {
			runnerGrants = '{}';
		},
		revoke: () => store.revoke(owner.record.idHash, now + elapsed),
		session: (input?: unknown) => serve(approvalRequest(url, 'Bearer ' + owner.credential, input)),
		nonOwner: async (input: unknown) => serve(approvalRequest(url, await native(OTHER), input)),
		scoped: async (input: unknown) =>
			serve(approvalRequest(url, await native(OWNER, 'project:synthetic'), input)),
		browser: async (input: unknown) => {
			const request = approvalRequest(url, '', input);
			request.headers.delete('authorization');
			request.headers.set('cookie', SESSION_COOKIE + '=' + browser.credential);
			return serve(request);
		},
		runner: (input: unknown) => serve(approvalRequest(url, 'DeployRunner ' + key, input))
	};
}

function approvalRequest(url: string, authorization: string, input?: unknown) {
	return new Request(url, {
		method: input === undefined ? 'GET' : 'POST',
		headers: { authorization, origin: ORIGIN, 'content-type': 'application/json' },
		body: input === undefined ? undefined : JSON.stringify(input)
	});
}
