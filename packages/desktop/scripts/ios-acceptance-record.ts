import { redacted } from './ios-acceptance-guards';

export interface AcceptanceCheck {
	phase: string;
	name: string;
	passed: boolean;
}

/**
 * TEST ONLY. What a native acceptance run found: every assertion by name, passed or failed. It
 * is told each one-time code the run was given and never prints or keeps one.
 */
export class AcceptanceRecord {
	readonly checks: AcceptanceCheck[] = [];
	private readonly secrets: string[] = [];
	private phase = '';

	constructor(private readonly print: (line: string) => void = console.log) {}

	begin(phase: string): void {
		this.phase = phase;
		this.print(`\n${phase}`);
	}

	/** A one-time code that must appear nowhere. */
	hide(secret: string): void {
		this.secrets.push(secret);
	}

	/** Text that is safe to print or write. */
	safe(text: string): string {
		return redacted(text, this.secrets);
	}

	check(passed: unknown, name: string): void {
		const check = { phase: this.phase, name: this.safe(name), passed: Boolean(passed) };
		this.checks.push(check);
		this.print(`${check.passed ? 'ok   ' : 'FAIL '}${check.name}`);
	}

	/** A phase that could not go on is a failed check, with the reason. */
	stopped(error: unknown): void {
		const reason = error instanceof Error ? error.message : String(error);
		this.check(false, `the phase stopped: ${reason.split('\n')[0].slice(0, 240)}`);
	}

	get failed(): number {
		return this.checks.filter((check) => !check.passed).length;
	}

	get passed(): number {
		return this.checks.length - this.failed;
	}
}
