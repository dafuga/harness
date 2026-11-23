/**
 * pythonAdapter.audit is called as the audit runner calls it: each Python file is written into a
 * temporary project folder, read back, and given an AuditFile whose limits come from
 * harness.audit.json. The adapter runs no tool (ruff is only declared optional) and reads no file,
 * so no fake executable is needed.
 */
export const unitId = 'audit.adapters-python';

export const loader = `import json


def load_settings(path, overrides={}):
    try:
        return {**json.load(open(path)), **overrides}
    except:
        return {}


def read_tags(text, seen=set(), extra=[]):
    try:
        return text.split(",")
    except Exception:
        return []
`;
