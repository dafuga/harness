// @harness-uid u_gvqtr5mdwv
import {
	closeSync,
	constants,
	fstatSync,
	openSync,
	readFileSync,
	realpathSync,
	statSync
} from 'node:fs';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { trackerHostEffectsSchema } from '../tracker-native-runtime-service/trackerHostEffectsSchema';
import { trackerRoutingSchema } from './trackerRoutingSchema';
import type { TrackerNodeConfig } from './trackerNodeConfig.types';

const absolutePath = z.string().refine(isAbsolute);
const nodeName = z.string().regex(/^[a-z0-9][a-z0-9.-]{0,79}$/);
const port = z.int().min(1024).max(65535);
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);
const configFields = {
	version: z.literal(1),
	node: nodeName,
	database: absolutePath,
	apiPort: port,
	legacyFenceFile: absolutePath,
	legacySupervisorSocket: absolutePath.optional(),
	syncSecretFile: absolutePath,
	backupDirectory: absolutePath.optional(),
	hostEffects: trackerHostEffectsSchema.optional(),
	autolaunch: z.strictObject({ enabled: z.boolean() }).optional(),
	routing: trackerRoutingSchema.optional(),
	notifications: z
		.strictObject({
			targets: z.record(
				id,
				z.union([
					z.strictObject({ url: z.string(), bearerFile: absolutePath.optional() }),
					z.strictObject({
						cli: z.enum(['claude', 'codex']),
						session: id.regex(/^[^.]+$/),
						tmux: absolutePath
					}),
					z.strictObject({ script: absolutePath })
				])
			),
			itemCallbacks: z.array(id).optional(),
			commandCallbacks: z.record(id, id).optional(),
			chiefOfStaff: id.optional(),
			webhook: id.optional(),
			routes: z
				.record(
					id,
					z.strictObject({
						target: id,
						aliases: z.array(z.string().min(1).max(80)).max(20).optional()
					})
				)
				.optional(),
			unrouted: z
				.partialRecord(
					z.enum([
						'needs_daniel',
						'due',
						'blocked',
						'done',
						'resolved',
						'changed',
						'recurring_due',
						'autolaunch'
					]),
					z.enum(['cos', 'drop'])
				)
				.optional(),
			suggestions: z.array(z.string().min(1).max(120)).max(30).optional()
		})
		.optional()
};
const upstream = z.strictObject({ url: z.string(), accessFile: absolutePath.optional() });
const configSchema = z.discriminatedUnion('role', [
	z.strictObject({ ...configFields, role: z.literal('hub'), syncPort: port }),
	z.strictObject({
		...configFields,
		role: z.literal('spoke'),
		upstream,
		peer: z.strictObject({ upstream, listenPort: port }).optional()
	})
]);

const fenceSchema = z.strictObject({
	version: z.literal(1),
	checkpoint: id,
	hostEffects: z.literal(true).optional(),
	legacyAutostart: z.literal('disabled'),
	node: nodeName,
	role: z.enum(['hub', 'spoke']),
	database: absolutePath,
	apiPort: port,
	syncPort: port.optional(),
	legacySupervisorSocket: absolutePath.optional()
});

export function loadTrackerNodeConfig(path: string): TrackerNodeConfig {
	const config = configSchema.parse(readPrivateJson(path));
	if (config.apiPort === trackerSyncPort(config)) throw new TypeError('Tracker ports must differ');
	const effects = config.hostEffects;
	if (
		effects?.mode === 'active' &&
		config.node !== 'daniel-primary-mbp' &&
		(effects.adapter || effects.watchdog?.chiefOfStaff)
	)
		throw new TypeError(
			'Tracker adapter polling and watchdog CoS delivery require the designated primary Mac'
		);
	return config;
}

export function trackerSyncPort(config: TrackerNodeConfig): number | undefined {
	return config.role === 'hub' ? config.syncPort : config.peer?.listenPort;
}

export function verifyTrackerLegacyFence(config: TrackerNodeConfig): string {
	const {
		checkpoint,
		node,
		role,
		database,
		apiPort,
		syncPort,
		legacySupervisorSocket,
		hostEffects
	} = fenceSchema.parse(readPrivateJson(config.legacyFenceFile));
	if (
		node !== config.node ||
		role !== config.role ||
		database !== config.database ||
		apiPort !== config.apiPort ||
		syncPort !== trackerSyncPort(config) ||
		legacySupervisorSocket !== config.legacySupervisorSocket
	)
		throw new TypeError('Tracker legacy fence does not cover this node');
	verifyHostEffectsFence(config, { checkpoint, hostEffects });
	return checkpoint;
}

function verifyHostEffectsFence(
	config: TrackerNodeConfig,
	{ checkpoint, hostEffects }: { checkpoint: string; hostEffects?: true }
) {
	const effects = config.hostEffects;
	if (effects?.mode === 'active' && (!hostEffects || effects.checkpoint !== checkpoint))
		throw new TypeError('Tracker fence does not authorize host effects');
}

export function verifyTrackerDatabasePath(path: string): void {
	const stat = statSync(path);
	if (
		path !== realpathSync(path) ||
		!stat.isFile() ||
		stat.nlink !== 1 ||
		stat.uid !== process.getuid?.() ||
		(stat.mode & 0o077) !== 0
	)
		throw new TypeError('Tracker database needs a canonical private file');
}

export function readPrivateText(path: string): string {
	if (!isAbsolute(path)) throw new TypeError('Tracker needs an absolute private file path');
	const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const stat = fstatSync(fd);
		if (
			!stat.isFile() ||
			stat.nlink !== 1 ||
			stat.uid !== process.getuid?.() ||
			(stat.mode & 0o077) !== 0 ||
			stat.size > 64 * 1024
		)
			throw new TypeError('Tracker needs a private file owned by the service user');
		return readFileSync(fd, 'utf8');
	} finally {
		closeSync(fd);
	}
}

export function readPrivateJson(path: string): unknown {
	return JSON.parse(readPrivateText(path));
}
