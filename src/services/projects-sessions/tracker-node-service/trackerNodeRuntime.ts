// @harness-uid u_gvqtr5mdwv
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { TrackerJobProcessAdapter } from '../../../adapters/projects-sessions/TrackerJobProcessAdapter';
import { TrackerMachineSamplerAdapter } from '../../../adapters/projects-sessions/TrackerMachineSamplerAdapter';
import { TrackerSyncAuthService } from '../../networking-security/TrackerSyncAuthService';
import {
	canonicalNode,
	trackerFleetNodes
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import {
	ladderFrom,
	parseTrackerModelSpec
} from '../../../utils/agents-providers/parseTrackerModelSpec';
import type { TrackerItemInput } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type { TrackerItemSnapshot } from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { trackerFleetMachineStore } from '../tracker-native-runtime-service/nativeTrackerLinks';
import type { TrackerGuestAuthWriter } from '../tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import { readPrivateJson, readPrivateText, trackerSyncPort } from './trackerNodeConfig';
import type { TrackerNodeConfig } from './trackerNodeConfig.types';
import { configuredOutgoingProvider } from './configuredOutgoingProvider';
import { trackerNodeNotifications } from './trackerNodeNotifications';
import { trackerUpstreamLink } from './trackerUpstreamLink';

export function trackerNodeRuntime(
	config: TrackerNodeConfig,
	writeGuestAuth?: TrackerGuestAuthWriter
): TrackerNativeRuntimeOptions {
	const secret = readPrivateText(config.syncSecretFile).trim();
	if (secret.length < 16) throw new TypeError('Tracker sync key is too short');
	const hostEffectsHeld = config.hostEffects?.mode === 'held';
	const notification = hostEffectsHeld ? undefined : trackerNodeNotifications(config);
	const ladderConfig = { autolaunch: config.routing };
	const ladder = ladderFrom(ladderConfig);
	return {
		node: config.node,
		role: config.role,
		phoneWrite: configuredPhoneWrite(),
		backupDirectory: config.backupDirectory,
		backup: configuredTrackerBackups(config),
		notification,
		hostEffects: configuredHostEffects(config, writeGuestAuth),
		hostEffectsHeld,
		// Held and effect-free rehearsal nodes never notify anyone.
		webPush: config.hostEffects?.mode === 'active' ? { database: config.database } : undefined,
		manualLaunch: true,
		ladderConfig,
		automaticEnabled: trackerAutomaticSetting(config),
		machineSampler: new TrackerMachineSamplerAdapter(config.node, configuredTmux(config)),
		syncResponder: configuredSyncResponder(config, secret),
		outgoingProvider: configuredOutgoingProvider(config, {
			gmail: process.env.HARNESS_TRACKER_OUTGOING_GMAIL_BINDING,
			providers: process.env.HARNESS_TRACKER_OUTGOING_BINDINGS
		}),
		...(config.role === 'spoke' && { links: spokeLinks(config, secret) }),
		...(config.role === 'hub' && notification?.webhook && { recurring: boxJobs(config) }),
		validateModel(model) {
			parseTrackerModelSpec(String(model), ladder);
		},
		planLaunch: (fields, current, source) => planNativeLaunch(fields, current, config.node, source)
	};
}

/** The sampler labels agent sessions with their tmux names when it knows the executable. */
function configuredTmux(config: TrackerNodeConfig): string | undefined {
	const effects = config.hostEffects;
	if (effects?.mode !== 'active' || !effects.launch || !('managed' in effects.launch))
		return undefined;
	return effects.launch.managed.tmux;
}

/** Box job state and receipts live beside the journal that owns the job definitions. */
function boxJobs({ database }: TrackerNodeConfig) {
	return { jobs: new TrackerJobProcessAdapter(join(dirname(database), 'jobs')) };
}

/** A live hub backs itself up. Held and effect-free rehearsal nodes never write backups. */
function configuredTrackerBackups(config: TrackerNodeConfig) {
	if (config.role !== 'hub' || config.hostEffects?.mode !== 'active') return undefined;
	const shared = join(homedir(), 'backups', 'tracker');
	return {
		directory: config.backupDirectory ?? join(shared, 'native'),
		externalDirectory: config.backupDirectory ? undefined : shared,
		stateFile: join(dirname(config.database), 'tracker-backup.json')
	};
}

function trackerAutomaticSetting(config: TrackerNodeConfig): () => boolean {
	const native = config.autolaunch;
	if (native) return () => native.enabled;
	const path = join(homedir(), '.config/tracker/config.json');
	let enabled = false;
	let refreshAt = 0;
	return () => {
		const now = Date.now();
		if (now < refreshAt) return enabled;
		refreshAt = now + 1000;
		try {
			const legacy = readPrivateJson(path) as { autolaunch?: { enabled?: boolean } };
			enabled = legacy.autolaunch?.enabled !== false;
		} catch (error) {
			enabled = error instanceof Error && 'code' in error && error.code === 'ENOENT';
		}
		return enabled;
	};
}

function configuredSyncResponder(config: TrackerNodeConfig, secret: string) {
	if (config.role === 'spoke' && !config.peer) return undefined;
	const ownerKeyPath = config.role === 'hub' && process.env.HARNESS_TRACKER_OUTGOING_OWNER_KEY_FILE;
	const ownerKey = ownerKeyPath ? readPrivateText(ownerKeyPath).trim() : '';
	if (ownerKeyPath && (ownerKey.length < 32 || ownerKey === secret))
		throw new TypeError('Tracker outgoing owner key requires a distinct private grant');
	return {
		auth: new TrackerSyncAuthService(secret),
		outgoingOwnerAuth: ownerKey ? new TrackerSyncAuthService(ownerKey) : undefined,
		...(config.role === 'hub' && { machines: trackerFleetMachineStore() })
	};
}

function configuredPhoneWrite(): TrackerNativeRuntimeOptions['phoneWrite'] {
	const device = process.env.HARNESS_TRACKER_PHONE_WRITE_DEVICE?.trim();
	const token = process.env.HARNESS_TRACKER_PHONE_WRITE_TOKEN;
	return device && token ? { device, token } : undefined;
}

function configuredHostEffects(
	config: TrackerNodeConfig,
	writeGuestAuth?: TrackerGuestAuthWriter
): TrackerNativeRuntimeOptions['hostEffects'] {
	const effects = config.hostEffects;
	if (effects?.mode !== 'active') return undefined;
	const { launch, watchdog, adapter } = effects;
	return {
		launch,
		watchdog,
		workerClient: {
			node: config.node,
			role: config.role,
			apiPort: config.apiPort,
			syncPort: trackerSyncPort(config),
			writeGuestAuth
		},
		adapter: adapter && {
			...adapter,
			leaseFile: join(dirname(config.database), 'adapter-runner.lock')
		}
	};
}

function spokeLinks(config: Extract<TrackerNodeConfig, { role: 'spoke' }>, secret: string) {
	const links = [trackerUpstreamLink(config.upstream, secret, 'hub', Boolean(config.peer))];
	if (config.peer) links.push(trackerUpstreamLink(config.peer.upstream, secret, 'peer', true));
	return links;
}

function planNativeLaunch(
	fields: TrackerItemInput,
	current: TrackerItemSnapshot | undefined,
	node: string,
	source: 'manual' | 'automatic'
) {
	const desired = String(fields.computer ?? current?.computer ?? 'auto');
	const target = launchTarget(desired, node);
	if (current?.auto && (current.status === 'open' || current.status === 'in_progress')) {
		return existingNativeLaunch(fields, current, target);
	}
	return {
		...fields,
		computer: target,
		launch_target: target,
		launch_source: source,
		launch_pick: null
	};
}

function existingNativeLaunch(
	fields: TrackerItemInput,
	current: TrackerItemSnapshot,
	target: string
) {
	const previousTarget = current.launch_target ?? current.computer ?? target;
	const optionsMatch = (['project', 'repo', 'model'] as const).every(
		(key) => (fields[key] ?? current[key]) === current[key]
	);
	const sensitiveMatches =
		Boolean(fields.sensitive ?? current.sensitive) === Boolean(current.sensitive);
	if (target !== previousTarget || !optionsMatch || !sensitiveMatches) {
		throw trackerItemError(
			'launch already queued; cancel it before changing its target or options',
			409
		);
	}
	return {
		...fields,
		auto: current.auto,
		computer: current.computer,
		launch_target: previousTarget,
		launch_source: current.launch_source
	};
}

function launchTarget(input: string, node: string) {
	const wanted = input.trim().toLowerCase();
	if (wanted === 'auto' || !wanted) return node;
	const target = canonicalNode(wanted, {});
	if (target === node || trackerFleetNodes.includes(target)) return target;
	throw trackerItemError('computer must be mac, mb2, box, auto, or this Tracker node');
}
