import { writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Journal } from '../src/core/execution-runtimes/scripted-deploy/contracts';
import { deployFixture } from './support/scripted-deploy/fixture';

let fixture: Awaited<ReturnType<typeof deployFixture>>;
beforeEach(async () => {
	fixture = await deployFixture();
});
afterEach(() => fixture.dispose());
describe('scripted deployment CLI', () => {
	it('only inspects in plan mode and promotes the same artifact through exact signoffs', () => {
		const args = ['fixture', 'staging', '--release', fixture.release.id];
		expect(() => fixture.run(...args, '--publish-plan')).toThrow(/requires --plan/);
		expect(() => fixture.run(...args, '--plan', '--wait-for-go')).toThrow(/applies only/);
		expect(() =>
			fixture.run('fixture', 'staging', '--ref', 'a'.repeat(40), '--wait-for-go')
		).toThrow(/immutable --release/);
		expect(fixture.operations()).toEqual([]);
		expect(fixture.run(...args, '--plan')).toMatchObject({ parity: { blocked: false } });
		expect(fixture.operations()).toEqual(['inspect', 'inspect', 'inspect']);
		const stage = fixture.promote('staging');
		expect(stage.phase).toBe('complete');
		expect(() => fixture.promote('preprod', stage.plan.id)).toThrow(/signed predecessor/i);
		fixture.review(stage);
		const preprod = fixture.promote('preprod', stage.plan.id);
		expect(preprod.phase).toBe('complete');
		expect(() => fixture.promote('prod', stage.plan.id)).toThrow(/signed predecessor/i);
		fixture.review(preprod);
		const prod = fixture.promote('prod', preprod.plan.id);
		expect(prod.result?.observed.artifact).toBe(fixture.release.artifact);
		expect(prod.approval?.payload.issuer).toBe('daniel');
		expect(prod.plan.predecessor).toBe(preprod.plan.id);
	});

	it.each(['wrong-scope', 'expired', 'changed-after-grant'])(
		'blocks %s before provider apply',
		(mode) => {
			fixture.mode(mode);
			expect(() => fixture.promote('staging')).toThrow(/authorization|changed after planning/i);
			expect(fixture.operations()).not.toContain('apply');
			expect(fixture.store.active('fixture', 'staging')).toBeNull();
		}
	);

	it('requires Daniel’s signature even after preprod admission conditions pass', () => {
		const stage = fixture.review(fixture.promote('staging'));
		fixture.mode('wrong-issuer');
		expect(() => fixture.promote('preprod', stage.plan.id)).toThrow(/authorization/i);
		expect(fixture.operations().filter((operation) => operation === 'apply')).toHaveLength(1);
	});

	it('detects changed artifact bytes before authorizing', () => {
		writeFileSync(fixture.store.artifact(fixture.release.id), 'unexpected artifact');
		expect(() => fixture.promote('staging')).toThrow(/artifact.*changed/i);
		expect(fixture.operations()).not.toContain('authorize');
	});

	it('reconciles lost provider receipts without resubmitting and restores the previous release', () => {
		fixture.mode('lost-receipt');
		expect(() => fixture.promote('staging')).toThrow(/broker apply failed/);
		const id = fixture.store.active('fixture', 'staging')!;
		expect(fixture.store.get(id).phase).toBe('applying');
		expect(() => fixture.promote('staging')).toThrow(/active or unresolved run/);
		fixture.mode('normal');
		expect(fixture.run('resume', id)).toMatchObject({ phase: 'complete' });
		expect(fixture.operations().filter((operation) => operation === 'apply')).toHaveLength(1);
		const restored = fixture.run('rollback', 'fixture', 'staging', '--run', id) as Journal;
		expect(restored.phase).toBe('complete');
		expect(restored.result?.observed.version).toBe('initial-staging');
		expect(fixture.store.active('fixture', 'staging')).toBeNull();
	});
});
