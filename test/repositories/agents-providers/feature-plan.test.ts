import { expect, test } from 'vitest';
import { FeaturePlanRepository } from '../../../src/repositories/agents-providers/FeaturePlanRepository';

test('FeaturePlanRepository.find from empty initialization returns missing', () => {
	const repository = new FeaturePlanRepository();
	// => undefined
	expect(repository.find(1)).toBeUndefined();
});

test('FeaturePlanRepository.find from populated initialization returns matching and missing records', () => {
	const repository = new FeaturePlanRepository();
	const record = { id: 1 };
	repository.save(record);
	// => { id: 1 }
	expect(repository.find(record.id)).toBe(record);
	// => undefined
	expect(repository.find(2)).toBeUndefined();
});

test('FeaturePlanRepository.save from empty initialization stores valid records and rejects invalid records', () => {
	const repository = new FeaturePlanRepository();
	const record = { id: 1 };
	// => { id: 1 }
	expect(repository.save(record)).toBe(record);
	expect(repository.find(record.id)).toBe(record);
	// throws TypeError
	expect(() => new FeaturePlanRepository().save(null as never)).toThrow(TypeError);
});

test('FeaturePlanRepository.save from populated initialization replaces valid records and rejects invalid records', () => {
	const original = { id: 1, label: 'original' };
	const repository = new FeaturePlanRepository<typeof original>();
	repository.save(original);
	const replacement = { id: 1, label: 'replacement' };
	// => { id: 1, label: 'replacement' }
	expect(repository.save(replacement)).toBe(replacement);
	expect(repository.find(replacement.id)).toBe(replacement);
	// throws TypeError
	expect(() => repository.save(null as never)).toThrow(TypeError);
	expect(repository.find(replacement.id)).toBe(replacement);
});
