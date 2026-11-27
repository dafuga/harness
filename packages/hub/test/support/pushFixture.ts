import { readFileSync } from 'node:fs';
import { generateWebPushKeys } from '../../../../src/services/projects-sessions/tracker-web-push-service/webPushTokens';
import { servePush } from '../../src/routes/api/push/pushPolicy';
import { SESSION_COOKIE } from '../../src/utils/accounts-access/authCookies';
import { ORIGIN } from './authFixture';
import { sheets } from './hubHomeFixture';
import { NOW, overviewFixture } from './trackerOverviewFixture';

export const mac = 'https://fcm.googleapis.com/fcm/send/synthetic-mac';

const migration = readFileSync(
	new URL('../../db/migrations/0009-web-push.sql', import.meta.url),
	'utf8'
);

export /** The real push routes on a real D1, with the sender's real tokens. */
async function pushHub() {
	const { db, close } = await sheets(migration);
	const sessions = overviewFixture();
	const keys = generateWebPushKeys();
	const config = { version: 1 as const, hubOrigin: ORIGIN, ...keys };
	let now = NOW;
	const serve = (request: Request, publicKey: string | null = keys.publicKey) =>
		servePush(request, {
			...sessions.homeDeps(),
			ownerId: sessions.owner,
			publicKey: publicKey ?? undefined,
			origin: ORIGIN,
			db,
			now
		});
	/** A browser's own request: `origin` stands in for another site's page when it differs. */
	const browser = (
		method: string,
		path: string,
		cookie: string,
		{ body, origin = ORIGIN }: { body?: unknown; origin?: string } = {}
	) =>
		new Request(`${ORIGIN}/api/push${path}`, {
			method,
			headers: {
				cookie: `${SESSION_COOKIE}=${cookie}`,
				origin,
				'content-type': 'application/json'
			},
			body: body === undefined ? null : JSON.stringify(body)
		});
	const sender = (authorization: string, method = 'GET', body?: unknown) =>
		new Request(`${ORIGIN}/api/push/sender`, {
			method,
			headers: { authorization },
			body: body === undefined ? null : JSON.stringify(body)
		});
	return {
		db,
		close,
		sessions,
		keys,
		config,
		serve,
		browser,
		sender,
		clock: () => now,
		advance(ms: number) {
			now += ms;
		}
	};
}
