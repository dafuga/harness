// @harness-uid u_ipjjmhcibp
import { vaultSecurityAudit } from '../../utils/accounts-access/vaultSecurityAudit';
import type { VaultSecurityVerdict } from '../../utils/accounts-access/vaultSecurityAudit.types';
import type { VaultTeardownStep } from '../../utils/accounts-access/vaultTeardown.types';
import type {
	VaultSecurityCheck,
	VaultTeardownConfig,
	VaultTeardownOutcome
} from './VaultTeardownService.types';

/** Executes the trusted teardown plan while recording redacted failures and deferred checks. */
export class VaultTeardownService {
	private readonly now: () => number;

	constructor(private readonly config: VaultTeardownConfig) {
		this.now = config.now ?? Date.now;
	}

	async run(steps: VaultTeardownStep[], leaseSessions: string[]): Promise<VaultTeardownOutcome> {
		const outcome: VaultTeardownOutcome = { failed: [], audit: [], followUps: [] };
		for (const step of steps) {
			if (step.step === 'security-log') {
				if (step.at > this.now()) outcome.followUps.push(step);
				else outcome.audit.push(await this.check(step, leaseSessions));
			} else if (step.step === 'flag-unverifiable') {
				outcome.audit.push({ verdict: 'unverifiable', reason: step.reason });
			} else {
				const ok = await this.config.cleanup(step).then(
					() => this.now() <= step.by,
					() => false
				);
				if (!ok) outcome.failed.push(step.step);
			}
		}
		return outcome;
	}

	private async check(
		step: VaultSecurityCheck,
		leaseSessions: string[]
	): Promise<VaultSecurityVerdict> {
		const events = await this.config.readSecurityLog(step).catch(() => null);
		return vaultSecurityAudit(events, { from: step.from, to: this.now(), leaseSessions });
	}
}
