import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogRevisionEntity } from '../../src/models/git-source-history/CatalogRevisionEntity';
import type { CatalogRevisionEntityAttributes } from '../../src/models/git-source-history/CatalogRevisionEntity.types';

export const row: CatalogRevisionEntityAttributes = {
	id: 'catalog-revision-entity-001',
	commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
	entityId: 'catalog-entity-042'
};

export const table = 'catalog_revision_entities';

export const adapter = (methods: Record<string, (...args: unknown[]) => unknown>) =>
	methods as unknown as Parameters<typeof CatalogRevisionEntity.find>[0];

export const updateRevisionEntityExample = async () => {
	const calls: unknown[][] = [];
	const patch = { entityId: 'catalog-entity-077' };
	const updated = { ...row, ...patch };
	const persistence = adapter({
		update: async (...args: unknown[]) => {
			calls.push(args);
			return updated;
		}
	});
	const result = await CatalogRevisionEntity.update(persistence, row.id, patch);
	const error = new Error('update failed');
	await expect(
		CatalogRevisionEntity.update(
			adapter({
				update: async () => {
					throw error;
				}
			}),
			row.id,
			patch
		)
	).rejects.toBe(error);
	expect(result).toEqual(updated);
	expect(calls).toEqual([[table, row.id, patch]]);
	recordExampleCases(
		{
			unitId: 'model.catalog-revision-entity',
			symbol: 'CatalogRevisionEntity.update',
			state: 'updates-revision-entity-attributes-by-identifier',
			evidence: 'examples-cases',
			file: 'updates-revision-entity-attributes-by-identifier.json'
		},
		[
			{
				name: 'adapter returns the updated membership row',
				input: { id: row.id, patch },
				output: result
			},
			{
				name: 'rejected adapter promise propagates unchanged',
				input: { id: row.id, patch, failure: true },
				error: error.message
			}
		]
	);
};

export const deleteRevisionEntityExample = async () => {
	const calls: unknown[][] = [];
	const persistence = adapter({
		delete: async (...args: unknown[]) => {
			calls.push(args);
			return true;
		}
	});
	const result = await CatalogRevisionEntity.delete(persistence, row.id);
	const error = new Error('delete failed');
	expect(() =>
		CatalogRevisionEntity.delete(
			adapter({
				delete: () => {
					throw error;
				}
			}),
			row.id
		)
	).toThrow(error);
	expect(result).toBe(true);
	expect(calls).toEqual([[table, row.id]]);
	recordExampleCases(
		{
			unitId: 'model.catalog-revision-entity',
			symbol: 'CatalogRevisionEntity.delete',
			state: 'deletes-a-revision-entity-membership-row',
			evidence: 'examples-cases',
			file: 'deletes-a-revision-entity-membership-row.json'
		},
		[
			{
				name: 'adapter confirms deletion of the identified row',
				input: { id: row.id },
				output: result
			},
			{
				name: 'synchronous adapter exception propagates unchanged',
				input: { id: row.id, failure: true },
				error: error.message
			}
		]
	);
};

export const revisionEntityFailureExample = async () => {
	const adapterError = new Error('adapter failed');
	const fieldError = new Error('field read failed');
	const throwingFields = Object.defineProperty({}, 'entityId', {
		enumerable: true,
		get: () => {
			throw fieldError;
		}
	});
	expect(() =>
		CatalogRevisionEntity.find(
			adapter({
				find: () => {
					throw adapterError;
				}
			}),
			row.id
		)
	).toThrow(adapterError);
	await expect(
		CatalogRevisionEntity.findBy(
			adapter({
				findBy: async () => {
					throw adapterError;
				}
			}),
			{ entityId: row.entityId }
		)
	).rejects.toBe(adapterError);
	expect(() =>
		CatalogRevisionEntity.create(
			adapter({ create: async () => row }),
			throwingFields as CatalogRevisionEntityAttributes
		)
	).toThrow(fieldError);
	expect(() =>
		CatalogRevisionEntity.update(
			adapter({ update: async () => row }),
			row.id,
			throwingFields as Partial<CatalogRevisionEntityAttributes>
		)
	).toThrow(fieldError);
	recordFailureCases(adapterError, fieldError);
};

function recordFailureCases(adapterError: Error, fieldError: Error): void {
	recordExampleCases(
		{
			unitId: 'model.catalog-revision-entity',
			symbol: 'CatalogRevisionEntity',
			state: 'throws-adapter-or-copied-field-error-unchanged',
			evidence: 'examples-cases',
			file: 'throws-adapter-or-copied-field-error-unchanged.json'
		},
		[
			{
				name: 'find adapter exception propagates unchanged',
				input: { operation: 'find', failure: true },
				error: adapterError.message
			},
			{
				name: 'findBy adapter rejection propagates unchanged',
				input: { operation: 'findBy', failure: true },
				error: adapterError.message
			},
			{
				name: 'create copied-field getter exception propagates unchanged',
				input: { operation: 'create', field: 'entityId' },
				error: fieldError.message
			},
			{
				name: 'update copied-field getter exception propagates unchanged',
				input: { operation: 'update', field: 'entityId' },
				error: fieldError.message
			}
		]
	);
}
