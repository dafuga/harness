import { test } from 'vitest';
import { checkAuditExample } from './support/auditFixture';

test('runAudit: audits valid source', () => checkAuditExample(0));
test('runAudit: rejects oversized source', () => checkAuditExample(1));
test('runAudit: reports a missing CLI file', () => checkAuditExample(2));
test('runAudit: throws when the fallback command is unavailable', () => checkAuditExample(3));
