import { test, expect } from 'vitest';
import { IpcRequestValidator } from '../../src/validators/IpcRequestValidator';
test('IPC retains explicit project scope and rejects malformed and credential-bearing identifiers', () => {
	const validator = new IpcRequestValidator();
	expect(validator.parse('project:agents', { projectId: 'local-123' })).toEqual({
		projectId: 'local-123'
	});
	expect(() => validator.parse('project:agents', { projectId: 'https://token@host' })).toThrow();
	expect(
		validator.parse('entity:read', {
			projectId: 'local-123',
			entityId: 'page.home',
			commit: 'a'.repeat(40)
		})
	).toEqual({ projectId: 'local-123', entityId: 'page.home', commit: 'a'.repeat(40) });
	expect(() => validator.parse('project:select', { projectId: 'https://token@host' })).toThrow();
	expect(() =>
		validator.parse('project:snapshot', { projectId: 42, branch: null, commit: null })
	).toThrow();
});
