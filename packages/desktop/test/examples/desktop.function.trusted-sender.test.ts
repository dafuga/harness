import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { trustedSender } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/trustedSender';

function checkSender(input: { senderMatches: boolean; frameMatches: boolean; url: string }) {
	const mainFrame = { url: input.url };
	const webContents = { mainFrame };
	const event = {
		sender: input.senderMatches ? webContents : {},
		senderFrame: input.frameMatches ? mainFrame : { url: input.url }
	};
	return trustedSender(
		event as Parameters<typeof trustedSender>[0],
		{ webContents } as Parameters<typeof trustedSender>[1]
	);
}

test('trusts only the expected window main frame at an allowed URL', () => {
	const accepted = checkSender({
		senderMatches: true,
		frameMatches: true,
		url: 'harness://app/projects'
	});
	const otherSender = checkSender({
		senderMatches: false,
		frameMatches: true,
		url: 'harness://app/projects'
	});
	const childFrame = checkSender({
		senderMatches: true,
		frameMatches: false,
		url: 'harness://app/projects'
	});
	const rejectedUrl = checkSender({
		senderMatches: true,
		frameMatches: true,
		url: 'https://example.test/'
	});

	expect(accepted).toBe(true);
	expect(otherSender).toBe(false);
	expect(childFrame).toBe(false);
	expect(rejectedUrl).toBe(false);

	recordExampleCases(
		{
			unitId: 'desktop.function.trusted-sender',
			symbol: 'trustedSender',
			state: 'trusts-only-the-expected-window-main-frame-at-an-allowed-url',
			evidence: 'examples-cases',
			file: 'trusts-only-the-expected-window-main-frame-at-an-allowed-url.json'
		},
		[
			{
				name: 'accept the expected window main frame on the app URL',
				input: { senderMatches: true, frameMatches: true, url: 'harness://app/projects' },
				output: accepted
			},
			{
				name: 'reject a sender from another window',
				input: { senderMatches: false, frameMatches: true, url: 'harness://app/projects' },
				output: otherSender
			},
			{
				name: 'reject a child frame in the expected window',
				input: { senderMatches: true, frameMatches: false, url: 'harness://app/projects' },
				output: childFrame
			},
			{
				name: 'reject a URL outside the app scheme',
				input: { senderMatches: true, frameMatches: true, url: 'https://example.test/' },
				output: rejectedUrl
			}
		]
	);
});
