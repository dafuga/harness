// @harness-uid u_qvo6rcr4rm
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ViewerAccess, ViewerDevices } from './ViewerDeviceRepository.types';

const pairingMs = 24 * 60 * 60 * 1000;
const maxPending = 5;
const attendedMs = 45_000;

/**
 * Devices allowed to watch and control a container browser. Only hashes of their cookies are kept.
 * Pairing codes are not secrets: approving one admits only the browser already displaying it.
 */
export class ViewerDeviceRepository {
	constructor(
		private readonly directory: string,
		private readonly now: () => number = Date.now,
		private readonly lifetimeMs?: number
	) {}

	access(token: string | undefined): ViewerAccess {
		if (!token) return { status: 'unknown' };
		const state = this.load();
		const hash = digest(token);
		if (state.devices.some((device) => device.hash === hash)) return { status: 'approved' };
		const waiting = state.pending.find((pairing) => pairing.hash === hash);
		return waiting ? { status: 'pending', code: waiting.code } : { status: 'unknown' };
	}

	request(): { token: string; code: string } {
		const state = this.load();
		const token = randomBytes(32).toString('base64url');
		let code: string;
		do code = String(randomInt(0, 1_000_000)).padStart(6, '0');
		while (state.pending.some((pairing) => pairing.code === code));
		const pairing = {
			hash: digest(token),
			code,
			expiresAt: this.now() + (this.lifetimeMs ?? pairingMs)
		};
		state.pending = [...state.pending, pairing].slice(-maxPending);
		this.save(state);
		return { token, code };
	}

	approve(code: string): boolean {
		const state = this.load();
		const found = state.pending.find((pairing) => pairing.code === code);
		if (!found) return false;
		state.pending = state.pending.filter((pairing) => pairing !== found);
		state.devices.push({ hash: found.hash, approvedAt: new Date(this.now()).toISOString() });
		this.save(state);
		return true;
	}

	counts(): { devices: number; pending: number } {
		const { devices, pending } = this.load();
		return { devices: devices.length, pending: pending.length };
	}

	revokeAll(): void {
		this.save({ version: 1, devices: [], pending: [] });
	}

	/** Called while someone is watching, so unattended reads never fight over the page. */
	markAttended(watching: boolean): void {
		const marker = join(this.directory, 'attended');
		if (!watching) {
			rmSync(marker, { force: true });
			return;
		}
		mkdirSync(this.directory, { recursive: true, mode: 0o700 });
		writeFileSync(marker, '', { mode: 0o600 });
	}

	attended(): boolean {
		try {
			return this.now() - statSync(join(this.directory, 'attended')).mtimeMs < attendedMs;
		} catch {
			return false;
		}
	}

	private load(): ViewerDevices {
		let raw: string;
		try {
			raw = readFileSync(join(this.directory, 'devices.json'), 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			return { version: 1, devices: [], pending: [] };
		}
		const state = JSON.parse(raw) as ViewerDevices;
		const now = this.now();
		state.pending = state.pending.filter((pairing) => pairing.expiresAt > now);
		const lifetime = this.lifetimeMs;
		if (lifetime)
			state.devices = state.devices.filter(
				(device) => Date.parse(device.approvedAt) + lifetime > now
			);
		return state;
	}

	private save(state: ViewerDevices): void {
		mkdirSync(this.directory, { recursive: true, mode: 0o700 });
		const path = join(this.directory, 'devices.json');
		const next = `${path}.${process.pid}.tmp`;
		writeFileSync(next, JSON.stringify(state) + '\n', { mode: 0o600 });
		renameSync(next, path);
	}
}

function digest(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}
