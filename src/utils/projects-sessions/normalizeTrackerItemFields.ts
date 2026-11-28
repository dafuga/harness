// @harness-uid u_dv4lnm54rz
import { normalizeTrackerCron } from './normalizeTrackerCron';
import {
	normalizeTrackerDue,
	trackerIsoTime,
	trackerTimeZone,
	validateTrackerTimeZone
} from './normalizeTrackerDue';
import { trackerAskNormalizers } from './trackerAskOptions';
import { trackerItemPriority } from './trackerItemPriority';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';
import type {
	TrackerItemClock,
	TrackerItemFields,
	TrackerItemInput,
	TrackerItemValue
} from './normalizeTrackerItemFields.types';

const kinds = ['task', 'plan', 'goal', 'recurring', 'reminder'];
const statuses = ['open', 'in_progress', 'blocked', 'done', 'ignored'];
const recurringClearValues = new Set<TrackerItemValue>([null, '', 'none']);

const textFields = new Set([
	'owner',
	'agent',
	'notes',
	'parent',
	'question',
	'next_step',
	'answer',
	'answered_at',
	'answered_by',
	'created_at',
	'created_by',
	'blocked_reason',
	'project',
	'computer',
	'model',
	'launch_target',
	'launch_source',
	'launch_pick',
	'schedule_status',
	'schedule_hold_reason',
	'ignored_reason',
	'ignored_by',
	'ignored_at',
	'ignored_prev_status',
	'adapter_notice',
	'adapter_instructions',
	'adapter_due_owner',
	'chase+'
]);
const flagFields = new Set([
	'needs_daniel',
	'resolved',
	'deleted',
	'sensitive',
	'schedule_off',
	'adapter_closed'
]);

function normalizeText(value: TrackerItemValue): string | null {
	return value === null || value === '' ? null : String(value).trim();
}

const normalizeFlag = (value: TrackerItemValue): number =>
	value && value !== '0' && value !== 'false' ? 1 : 0;

const normalizers = {
	kind: normalizeKind,
	priority: (value: TrackerItemValue) => trackerItemPriority(value),
	status: normalizeStatus,
	title: normalizeTitle,
	due: normalizeTrackerDue,
	remind_at: normalizeInstant,
	parked_until: normalizeInstant,
	ignored_until: normalizeTrackerDue,
	callback: normalizeCallback,
	repo: normalizeRepo,
	every: normalizeRecurrence,
	every_tz: normalizeTimeZone,
	occurrence: normalizeInstant,
	missed: normalizeInstant,
	last_result: normalizeResult,
	auto: normalizeLaunchToken,
	...trackerAskNormalizers
};

export function normalizeTrackerItemFields(
	input: TrackerItemInput,
	clock: TrackerItemClock
): TrackerItemFields {
	const fields: TrackerItemFields = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) fields[key] = normalizeField(key, value, clock, input);
	}
	return fields;
}

function normalizeField(
	key: string,
	value: TrackerItemValue,
	clock: TrackerItemClock,
	input: TrackerItemInput
): string | number | null {
	if (textFields.has(key)) return normalizeText(value);
	if (flagFields.has(key)) return normalizeFlag(value);
	if (!Object.hasOwn(normalizers, key)) throw trackerItemError(`unknown field "${key}"`);
	return normalizers[key as keyof typeof normalizers](value, clock, input);
}

function normalizeKind(value: TrackerItemValue): string {
	if (typeof value !== 'string' || !kinds.includes(value)) {
		throw trackerItemError(`kind must be one of ${kinds.join(', ')}`);
	}
	return value;
}

function normalizeStatus(value: TrackerItemValue): string {
	const normalized = String(value)
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	const status = normalized === 'inprogress' ? 'in_progress' : normalized;
	if (!statuses.includes(status)) {
		throw trackerItemError('status must be open, in_progress, blocked, done or ignored');
	}
	return status;
}

function normalizeTitle(value: TrackerItemValue): string {
	const title = String(value).trim();
	if (!title) throw trackerItemError('title must not be empty');
	return title;
}

function normalizeCallback(value: TrackerItemValue, clock: TrackerItemClock): string | null {
	if (value === null || value === '') return null;
	if (!value || typeof value !== 'object') {
		throw trackerItemError('callback must be {url} or {cmd}');
	}
	const target = value as TrackerItemInput;
	const node = trackerItemValueOr(target.node, clock.node);
	if (target.url) return JSON.stringify({ url: validateCallbackUrl(target.url), node });
	if (target.cmd && String(target.cmd).trim())
		return JSON.stringify({ cmd: String(target.cmd), node });
	throw trackerItemError('callback must have url or cmd');
}

function validateCallbackUrl(value: TrackerItemValue): string {
	const text = String(value);
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		throw trackerItemError('callback url is not a valid URL');
	}
	if (!/^https?:$/.test(url.protocol)) throw trackerItemError('callback url must be http(s)');
	return text;
}

function normalizeRepo(value: TrackerItemValue): string | null {
	const repo = normalizeText(value);
	if (repo && !repo.startsWith('/') && !repo.startsWith('~')) {
		throw trackerItemError('repo must be an absolute path');
	}
	return repo;
}

function normalizeRecurrence(
	value: TrackerItemValue,
	clock: TrackerItemClock,
	input: TrackerItemInput
): string | null {
	if (clearsTrackerRecurrence(value)) return null;
	return normalizeTrackerCron(
		value,
		String(trackerItemValueOr(input.every_tz, trackerTimeZone)),
		clock.now
	);
}

export function clearsTrackerRecurrence(value: TrackerItemValue): boolean {
	return recurringClearValues.has(value);
}

function normalizeTimeZone(value: TrackerItemValue): string | null {
	const timeZone = normalizeText(value);
	if (timeZone) validateTrackerTimeZone(timeZone);
	return timeZone;
}

function normalizeInstant(value: TrackerItemValue): string | null {
	return value === null || value === '' ? null : trackerIsoTime(Date.parse(value as string));
}

function normalizeResult(value: TrackerItemValue): string | null {
	if (value === null || value === '') return null;
	return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeLaunchToken(value: TrackerItemValue, clock: TrackerItemClock): string | null {
	const token = readTrackerLaunchToken(value);
	if (token !== true) return token;
	if (!clock.launchNonce) throw new TypeError('A Tracker launch nonce is required');
	return `${clock.node}@${trackerIsoTime(clock.now)}#${clock.launchNonce}`;
}

export function requestsTrackerLaunch(value: TrackerItemValue): boolean {
	return value !== undefined && Boolean(readTrackerLaunchToken(value));
}

function readTrackerLaunchToken(value: TrackerItemValue): string | true | null {
	if ([null, '', false, 0, '0', 'false'].includes(value as string | number | boolean | null)) {
		return null;
	}
	if (value === true || value === 1 || value === '1' || value === 'true') return true;
	return String(value);
}
