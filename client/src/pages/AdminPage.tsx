import React, { useState, useCallback } from 'react';
import { useQuery, useMutation } from 'urql';
import { useAuth } from '../contexts/AuthContext';
import { USERS_QUERY, TEAMS_QUERY, PENDING_USERS_QUERY } from '../graphql/queries';
import {
  UPDATE_USER_ROLE_MUTATION,
  CREATE_TEAM_MUTATION,
  ADD_USER_TO_TEAM_MUTATION,
  REMOVE_USER_FROM_TEAM_MUTATION,
  APPROVE_USER_MUTATION,
  REJECT_USER_MUTATION,
  DISABLE_MFA_FOR_USER_MUTATION,
  RESET_PASSWORD_FOR_USER_MUTATION,
  SET_MFA_REQUIRED_MUTATION,
} from '../graphql/mutations';

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [usersResult, reexecuteUsers] = useQuery({ query: USERS_QUERY });
  const [teamsResult, reexecuteTeams] = useQuery({ query: TEAMS_QUERY });
  const [pendingResult, reexecutePending] = useQuery({ query: PENDING_USERS_QUERY });

  const [, updateRole] = useMutation(UPDATE_USER_ROLE_MUTATION);
  const [, createTeam] = useMutation(CREATE_TEAM_MUTATION);
  const [, addToTeam] = useMutation(ADD_USER_TO_TEAM_MUTATION);
  const [, removeFromTeam] = useMutation(REMOVE_USER_FROM_TEAM_MUTATION);
  const [, approveUser] = useMutation(APPROVE_USER_MUTATION);
  const [, rejectUser] = useMutation(REJECT_USER_MUTATION);
  const [, disableMfaForUser] = useMutation(DISABLE_MFA_FOR_USER_MUTATION);
  const [, resetPasswordForUser] = useMutation(RESET_PASSWORD_FOR_USER_MUTATION);
  const [, setMfaRequired] = useMutation(SET_MFA_REQUIRED_MUTATION);

  const [newTeamName, setNewTeamName] = useState('');
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [resetPwError, setResetPwError] = useState('');

  const users = usersResult.data?.users || [];
  const teams = teamsResult.data?.teams || [];
  const pendingUsers = pendingResult.data?.pendingUsers || [];

  const handleApprove = useCallback(async (userId: string) => {
    await approveUser({ userId });
    reexecutePending({ requestPolicy: 'network-only' });
    reexecuteUsers({ requestPolicy: 'network-only' });
  }, [approveUser, reexecutePending, reexecuteUsers]);

  const handleReject = useCallback(async (userId: string) => {
    await rejectUser({ userId });
    reexecutePending({ requestPolicy: 'network-only' });
    reexecuteUsers({ requestPolicy: 'network-only' });
  }, [rejectUser, reexecutePending, reexecuteUsers]);

  const handleRoleChange = useCallback(async (userId: string, role: string) => {
    await updateRole({ userId, role });
    reexecuteUsers({ requestPolicy: 'network-only' });
  }, [updateRole, reexecuteUsers]);

  const handleCreateTeam = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await createTeam({ name: newTeamName.trim() });
    setNewTeamName('');
    reexecuteTeams({ requestPolicy: 'network-only' });
  }, [newTeamName, createTeam, reexecuteTeams]);

  const handleAddToTeam = useCallback(async (userId: string, teamId: string) => {
    await addToTeam({ userId, teamId });
    reexecuteUsers({ requestPolicy: 'network-only' });
    reexecuteTeams({ requestPolicy: 'network-only' });
  }, [addToTeam, reexecuteUsers, reexecuteTeams]);

  const handleRemoveFromTeam = useCallback(async (userId: string) => {
    await removeFromTeam({ userId });
    reexecuteUsers({ requestPolicy: 'network-only' });
    reexecuteTeams({ requestPolicy: 'network-only' });
  }, [removeFromTeam, reexecuteUsers, reexecuteTeams]);

  const handleResetMfa = useCallback(async (userId: string) => {
    await disableMfaForUser({ userId });
    reexecuteUsers({ requestPolicy: 'network-only' });
  }, [disableMfaForUser, reexecuteUsers]);

  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwUserId) return;
    setResetPwError('');
    const result = await resetPasswordForUser({ userId: resetPwUserId, newPassword: resetPwValue });
    if (result.error) {
      setResetPwError(result.error.message);
      return;
    }
    setResetPwUserId(null);
    setResetPwValue('');
  }, [resetPwUserId, resetPwValue, resetPasswordForUser]);

  const handleToggleMfaRequired = useCallback(async (userId: string, required: boolean) => {
    await setMfaRequired({ userId, required });
    reexecuteUsers({ requestPolicy: 'network-only' });
  }, [setMfaRequired, reexecuteUsers]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Administration</h2>

      {/* Pending Registrations */}
      {pendingUsers.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Pending Registrations
            <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">({pendingUsers.length})</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Registered</th>
                  <th className="text-left px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {pendingUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{u.email}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{u.name || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 flex gap-2">
                      <button
                        onClick={() => handleApprove(u.id)}
                        className="text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Reset Password</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Set a new password for <span className="font-medium">{users.find((u: any) => u.id === resetPwUserId)?.email}</span>
            </p>
            {resetPwError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{resetPwError}</p>}
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={resetPwValue}
                  onChange={(e) => setResetPwValue(e.target.value)}
                  required
                  className="input-field"
                  placeholder="New password"
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">At least 10 characters with uppercase, lowercase, and a digit.</p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setResetPwUserId(null); setResetPwValue(''); setResetPwError(''); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-sm">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Users</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Role</th>
                <th className="text-left px-3 py-2">MFA</th>
                <th className="text-left px-3 py-2">Team</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{u.email}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{u.name || '-'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200"
                    >
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {u.mfaEnabled ? (
                        <>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">On</span>
                          <button
                            onClick={() => handleResetMfa(u.id)}
                            className="text-xs px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white"
                            title="Reset MFA for this user"
                          >
                            Reset
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Off</span>
                      )}
                      <label className="inline-flex items-center gap-1 ml-1 cursor-pointer" title="Require this user to enable MFA">
                        <input
                          type="checkbox"
                          checked={u.mfaRequired ?? false}
                          onChange={(e) => handleToggleMfaRequired(u.id, e.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Req</span>
                      </label>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                    {u.team ? (
                      <span className="inline-flex items-center gap-1">
                        {u.team.name}
                        <button
                          onClick={() => handleRemoveFromTeam(u.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                          title="Remove from team"
                        >
                          &times;
                        </button>
                      </span>
                    ) : (
                      <select
                        value=""
                        onChange={(e) => e.target.value && handleAddToTeam(u.id, e.target.value)}
                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200"
                      >
                        <option value="">Add to team...</option>
                        {teams.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setResetPwUserId(u.id); setResetPwValue(''); setResetPwError(''); }}
                        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Reset password for this user"
                      >
                        Reset PW
                      </button>
                      <span className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teams */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Teams</h3>

        <form onSubmit={handleCreateTeam} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="New team name"
            className="input-field flex-1"
          />
          <button type="submit" className="btn-primary text-sm" disabled={!newTeamName.trim()}>
            Create Team
          </button>
        </form>

        <div className="space-y-3">
          {teams.map((t: any) => (
            <div key={t.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="font-medium text-gray-900 dark:text-gray-100">{t.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t.members.length} member{t.members.length !== 1 ? 's' : ''}:
                {t.members.map((m: any) => m.email).join(', ') || ' None'}
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No teams created yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
