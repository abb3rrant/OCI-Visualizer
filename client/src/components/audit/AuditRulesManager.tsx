import React, { useState, useCallback } from 'react';
import { useQuery, useMutation } from 'urql';
import { AUDIT_RULES_QUERY } from '../../graphql/queries';
import {
  CREATE_AUDIT_RULE_MUTATION,
  UPDATE_AUDIT_RULE_MUTATION,
  DELETE_AUDIT_RULE_MUTATION,
} from '../../graphql/mutations';

interface AuditRule {
  id: string;
  name: string;
  description: string | null;
  resourceType: string;
  fieldPath: string;
  operator: string;
  value: string | null;
  severity: string;
  message: string;
  recommendation: string | null;
  category: string;
  framework: string | null;
  enabled: boolean;
}

interface RuleFormData {
  name: string;
  description: string;
  resourceType: string;
  fieldPath: string;
  operator: string;
  value: string;
  severity: string;
  message: string;
  recommendation: string;
  category: string;
  framework: string;
  enabled: boolean;
}

const EMPTY_FORM: RuleFormData = {
  name: '',
  description: '',
  resourceType: '',
  fieldPath: '',
  operator: 'exists',
  value: '',
  severity: 'MEDIUM',
  message: '',
  recommendation: '',
  category: 'Custom',
  framework: '',
  enabled: true,
};

const OPERATORS = [
  { value: 'exists', label: 'Exists' },
  { value: 'notExists', label: 'Does Not Exist' },
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'matches', label: 'Matches (Regex)' },
];

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const RESOURCE_TYPES = [
  { value: '*', label: 'All Resource Types' },
  { value: 'compute/instance', label: 'Compute Instance' },
  { value: 'network/vcn', label: 'VCN' },
  { value: 'network/subnet', label: 'Subnet' },
  { value: 'network/security-list', label: 'Security List' },
  { value: 'network/nsg', label: 'Network Security Group' },
  { value: 'network/load-balancer', label: 'Load Balancer' },
  { value: 'storage/bucket', label: 'Object Storage Bucket' },
  { value: 'storage/block-volume', label: 'Block Volume' },
  { value: 'storage/boot-volume', label: 'Boot Volume' },
  { value: 'storage/file-system', label: 'File System' },
  { value: 'database/autonomous', label: 'Autonomous Database' },
  { value: 'database/db-system', label: 'DB System' },
  { value: 'iam/policy', label: 'IAM Policy' },
  { value: 'iam/user', label: 'IAM User' },
  { value: 'iam/group', label: 'IAM Group' },
  { value: 'security/vault', label: 'Vault' },
  { value: 'security/bastion', label: 'Bastion' },
];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  INFO: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

function conditionSummary(rule: AuditRule): string {
  const op = OPERATORS.find(o => o.value === rule.operator)?.label || rule.operator;
  if (rule.operator === 'exists' || rule.operator === 'notExists') {
    return `${rule.fieldPath} ${op}`;
  }
  return `${rule.fieldPath} ${op} "${rule.value || ''}"`;
}

export default function AuditRulesManager() {
  const [rulesResult, reexecuteRules] = useQuery({ query: AUDIT_RULES_QUERY });
  const [, createRule] = useMutation(CREATE_AUDIT_RULE_MUTATION);
  const [, updateRule] = useMutation(UPDATE_AUDIT_RULE_MUTATION);
  const [, deleteRule] = useMutation(DELETE_AUDIT_RULE_MUTATION);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormData>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rules: AuditRule[] = rulesResult.data?.auditRules || [];

  const setField = useCallback(<K extends keyof RuleFormData>(key: K, value: RuleFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleEdit = useCallback((rule: AuditRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || '',
      resourceType: rule.resourceType,
      fieldPath: rule.fieldPath,
      operator: rule.operator,
      value: rule.value || '',
      severity: rule.severity,
      message: rule.message,
      recommendation: rule.recommendation || '',
      category: rule.category,
      framework: rule.framework || '',
      enabled: rule.enabled,
    });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const input = {
      name: form.name,
      description: form.description || undefined,
      resourceType: form.resourceType,
      fieldPath: form.fieldPath,
      operator: form.operator,
      value: form.value || undefined,
      severity: form.severity,
      message: form.message,
      recommendation: form.recommendation || undefined,
      category: form.category || 'Custom',
      framework: form.framework || undefined,
      enabled: form.enabled,
    };

    if (editingId) {
      await updateRule({ id: editingId, input });
    } else {
      await createRule({ input });
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    reexecuteRules({ requestPolicy: 'network-only' });
  }, [form, editingId, createRule, updateRule, reexecuteRules]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteRule({ id });
    setDeleteConfirm(null);
    reexecuteRules({ requestPolicy: 'network-only' });
  }, [deleteRule, reexecuteRules]);

  const handleToggleEnabled = useCallback(async (rule: AuditRule) => {
    await updateRule({
      id: rule.id,
      input: {
        name: rule.name,
        resourceType: rule.resourceType,
        fieldPath: rule.fieldPath,
        operator: rule.operator,
        value: rule.value,
        severity: rule.severity,
        message: rule.message,
        category: rule.category,
        enabled: !rule.enabled,
      },
    });
    reexecuteRules({ requestPolicy: 'network-only' });
  }, [updateRule, reexecuteRules]);

  const needsValue = form.operator !== 'exists' && form.operator !== 'notExists';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Define custom rules to evaluate against your resources during audit. Rules where the condition is NOT met produce a finding.
        </p>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="btn-primary text-sm whitespace-nowrap"
          disabled={rules.length >= 50}
        >
          + Add Rule
        </button>
      </div>

      {/* Rule Form */}
      {showForm && (
        <div className="card border-2 border-blue-500 dark:border-blue-400">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {editingId ? 'Edit Rule' : 'New Custom Rule'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  className="input-field text-sm"
                  placeholder="e.g. Require Environment tag"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Resource Type *</label>
                <select
                  value={form.resourceType}
                  onChange={e => setField('resourceType', e.target.value)}
                  className="input-field text-sm"
                  required
                >
                  <option value="">Select type...</option>
                  {RESOURCE_TYPES.map(rt => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Field Path *</label>
                <input
                  type="text"
                  value={form.fieldPath}
                  onChange={e => setField('fieldPath', e.target.value)}
                  className="input-field text-sm"
                  placeholder="e.g. freeformTags.Environment"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Operator *</label>
                <select
                  value={form.operator}
                  onChange={e => setField('operator', e.target.value)}
                  className="input-field text-sm"
                >
                  {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value {needsValue ? '*' : '(N/A)'}
                </label>
                <input
                  type="text"
                  value={form.value}
                  onChange={e => setField('value', e.target.value)}
                  className="input-field text-sm"
                  placeholder={needsValue ? 'Expected value' : 'Not applicable'}
                  disabled={!needsValue}
                  required={needsValue}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Severity *</label>
                <select
                  value={form.severity}
                  onChange={e => setField('severity', e.target.value)}
                  className="input-field text-sm"
                >
                  {SEVERITIES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setField('category', e.target.value)}
                  className="input-field text-sm"
                  placeholder="Custom"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Framework</label>
                <input
                  type="text"
                  value={form.framework}
                  onChange={e => setField('framework', e.target.value)}
                  className="input-field text-sm"
                  placeholder="e.g. CIS 1.2.3"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Finding Message *</label>
              <input
                type="text"
                value={form.message}
                onChange={e => setField('message', e.target.value)}
                className="input-field text-sm"
                placeholder="Message shown when the rule is violated"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                className="input-field text-sm"
                placeholder="Detailed explanation of the rule"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Recommendation</label>
              <input
                type="text"
                value={form.recommendation}
                onChange={e => setField('recommendation', e.target.value)}
                className="input-field text-sm"
                placeholder="What to do to fix the violation"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rule-enabled"
                checked={form.enabled}
                onChange={e => setField('enabled', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="rule-enabled" className="text-sm text-gray-700 dark:text-gray-300">Enabled</label>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary text-sm" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update Rule' : 'Create Rule'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules Table */}
      {rules.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Resource Type</th>
                <th className="text-left px-3 py-2">Condition</th>
                <th className="text-left px-3 py-2">Severity</th>
                <th className="text-center px-3 py-2">Enabled</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rules.map(rule => (
                <tr key={rule.id} className={!rule.enabled ? 'opacity-50' : ''}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{rule.name}</div>
                    {rule.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{rule.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {rule.resourceType === '*' ? 'All' : rule.resourceType}
                  </td>
                  <td className="px-3 py-2">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                      {conditionSummary(rule)}
                    </code>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY_COLORS[rule.severity] || ''}`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleToggleEnabled(rule)}
                      className={`w-8 h-4 rounded-full relative transition-colors ${
                        rule.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        rule.enabled ? 'left-4' : 'left-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-1"
                      >
                        Edit
                      </button>
                      {deleteConfirm === rule.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="text-xs text-red-600 dark:text-red-400 font-medium px-1"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs text-gray-500 dark:text-gray-400 px-1"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(rule.id)}
                          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card text-center py-8">
          <p className="text-gray-400 dark:text-gray-500">No custom audit rules yet. Click "Add Rule" to create your first rule.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Custom rules evaluate resource fields using dot-notation paths (e.g., freeformTags.Environment) and produce findings when conditions are NOT met.
          </p>
        </div>
      )}
    </div>
  );
}
