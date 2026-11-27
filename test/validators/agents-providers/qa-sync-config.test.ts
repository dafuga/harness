import { expect, test } from 'vitest';
import { QaSyncConfigValidator } from '../../../src/validators/agents-providers/QaSyncConfigValidator';
import { rawConfig } from '../../services/agents-providers/qa-sync/qaSyncFixture';

const parse = (value: object) => new QaSyncConfigValidator().parse(value);

test('QaSyncConfigValidator fills the label, reaction and lookback defaults', () => {
	const config = parse({ ...rawConfig, retest: undefined });
	expect(config.approval.label).toBe('approved by {name}');
	expect(config.approval.reactions).toContain('white_check_mark');
	expect(config.retest).toMatchObject({
		label: 'needs testing on {environment}',
		environments: { staging: ['staging'] }
	});
	expect([config.threads.headingMarker, config.lookbackDays]).toEqual(['QA · #', 30]);
});

test.each([
	['a credential field', { slackToken: 'x' }],
	['no thread authors', { threads: { authors: [] } }],
	['a label without its placeholder', { approval: { label: 'approved' } }],
	['an unknown default environment', { retest: { defaultEnvironment: 'qa' } }],
	['no inbox item', { tracker: { agent: 'demo' } }]
])('QaSyncConfigValidator refuses %s', (_name, change) => {
	expect(() => parse({ ...rawConfig, ...change })).toThrow();
});
