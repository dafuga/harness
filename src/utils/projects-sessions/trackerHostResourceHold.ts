// @harness-uid u_lct7zicebt
import type {
	TrackerHostResourceRequest,
	TrackerHostResources,
	TrackerHostVolume
} from './trackerHostResources.types';
import {
	trackerMacSessionMemoryReservePercent,
	trackerOverloadedLoadPerCore
} from './trackerMachineStatus';

export const trackerResourceHoldPrefix = 'Tracker host resource hold: ';

const macNodes = new Set(['daniel-primary-mbp', 'harbor-mbp-2']);
const sharedNode = 'grok-box';
const fleetDiskFloorGB = 30;
const overloaded = {
	label: 'this computer is overloaded',
	loadPerCore: trackerOverloadedLoadPerCore,
	ramPercent: 10,
	inodes: 50_000,
	inodePercent: 1
};
const busyShared = {
	label: 'the shared box is busy',
	loadPerCore: 1,
	ramPercent: 15,
	inodes: 100_000,
	inodePercent: 3
};

/** Why this computer cannot take another session right now, or null. */
export function trackerHostResourceHold(
	resources: TrackerHostResources,
	request: TrackerHostResourceRequest
): string | null {
	const reason =
		pressureHold(resources, request) ??
		memoryHold(resources, request) ??
		storageHold(resources, request);
	return reason && trackerResourceHoldPrefix + reason;
}

function pressureHold(resources: TrackerHostResources, { node }: TrackerHostResourceRequest) {
	if (macNodes.has(node)) return macPressureHold(resources);
	const [, sustained] = resources.load();
	const limits = node === sharedNode ? busyShared : overloaded;
	const ceiling = limits.loadPerCore * resources.cores();
	if (sustained > ceiling)
		return `${limits.label} (5-min load ${sustained.toFixed(2)} > ${ceiling})`;
	const { freePercent } = resources.memory();
	return freePercent !== null && freePercent < limits.ramPercent
		? `${limits.label} (RAM available ${Math.floor(freePercent)}% < ${limits.ramPercent}%)`
		: null;
}

function macPressureHold(resources: TrackerHostResources) {
	const { freePercent } = resources.memory();
	const reserve = trackerMacSessionMemoryReservePercent;
	return freePercent === null || freePercent < reserve
		? `free memory ${freePercent === null ? 'unknown' : `${freePercent}%`} (need at least ${reserve}%)`
		: null;
}

function memoryHold(resources: TrackerHostResources, { limits }: TrackerHostResourceRequest) {
	const { availableMB } = resources.memory();
	return availableMB >= (limits.minAvailableMemMB ?? 2048)
		? null
		: `only ${Math.round(availableMB)} MB RAM available`;
}

function storageHold(resources: TrackerHostResources, request: TrackerHostResourceRequest) {
	for (const [index, path] of request.paths.entries()) {
		let volume: TrackerHostVolume;
		try {
			volume = resources.volume(path);
		} catch {
			return `disk and inode availability could not be checked on ${path}`;
		}
		const hold = volumeHold(volume, { path, home: index === 0, request });
		if (hold) return hold;
	}
	return null;
}

function volumeHold(
	{ freeGB, freeInodes, inodeFreePercent }: TrackerHostVolume,
	{ path, home, request }: { path: string; home: boolean; request: TrackerHostResourceRequest }
) {
	const { node, limits } = request;
	const configured = limits.minFreeDiskGB ?? 5;
	const fleet = macNodes.has(node) || node === sharedNode;
	const minimum = home && fleet ? Math.max(configured, fleetDiskFloorGB) : configured;
	if (!(freeGB >= minimum))
		return `only ${freeGB.toFixed(1)} GB disk free on ${path} (need at least ${minimum} GB)`;
	return lowInodes({ freeInodes, inodeFreePercent }, node)
		? `only ${freeInodes ?? 'unknown'} inodes free on ${path}`
		: null;
}

/** Filesystems without a fixed inode count report neither reading. */
function lowInodes(
	{ freeInodes = Infinity, inodeFreePercent = 100 }: Omit<TrackerHostVolume, 'freeGB'>,
	node: string
) {
	const thresholds = node === sharedNode ? busyShared : overloaded;
	return freeInodes < thresholds.inodes || inodeFreePercent < thresholds.inodePercent;
}
