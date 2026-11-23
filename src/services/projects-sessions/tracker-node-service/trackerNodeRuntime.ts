// @harness-uid u_gvqtr5mdwv
import { dirname, join } from 'node:path';
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
import type { TrackerGuestAuthWriter } from '../tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import { readPrivateText, trackerSyncPort } from './trackerNodeConfig';
import type { TrackerNodeConfig } from './trackerNodeConfig.types';
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
	const ladder = ladderFrom();
	const phoneDevice = process.env.HARNESS_TRACKER_PHONE_WRITE_DEVICE?.trim();
	const phoneToken = process.env.HARNESS_TRACKER_PHONE_WRITE_TOKEN;
	return {
		node: config.node,
		role: config.role,
		phoneWrite: phoneDevice && phoneToken ? { device: phoneDevice, token: phoneToken } : undefined,
		backupDirectory: config.backupDirectory,
		notification,
		hostEffects: configuredHostEffects(config, writeGuestAuth),
		hostEffectsHeld,
		manualLaunch: true,
		...(config.role === 'hub' || config.peer
			? { syncResponder: { auth: new TrackerSyncAuthService(secret) } }
			: {}),
		...(config.role === 'spoke' && { links: spokeLinks(config, secret) }),
		...(config.role === 'hub' && notification?.webhook && { recurring: {} }),
		validateModel(model, project) {
			parseTrackerModelSpec(String(model), ladder, project ? String(project) : null);
		},
		planLaunch: (fields, current) => planNativeLaunch(fields, current, config.node)
	};
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
	node: string
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
		launch_source: 'manual',
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
