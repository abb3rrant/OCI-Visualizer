import React, { useState } from 'react';
import { useQuery, useMutation } from 'urql';
import { useSearchParams } from 'react-router-dom';
import { ME_QUERY } from '../graphql/queries';
import { SETUP_MFA_MUTATION, VERIFY_MFA_SETUP_MUTATION, DISABLE_MFA_MUTATION, CHANGE_PASSWORD_MUTATION } from '../graphql/mutations';

type MfaSetupData = {
  secret: string;
  qrCodeDataUri: string;
  backupCodes: string[];
};

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const mfaRequiredBanner = searchParams.get('mfa') === 'required';

  const [meResult, reexecuteMe] = useQuery({ query: ME_QUERY });
  const [, setupMfa] = useMutation(SETUP_MFA_MUTATION);
  const [, verifyMfaSetup] = useMutation(VERIFY_MFA_SETUP_MUTATION);
  const [, disableMfa] = useMutation(DISABLE_MFA_MUTATION);
  const [, changePassword] = useMutation(CHANGE_PASSWORD_MUTATION);

  // MFA state
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const user = meResult.data?.me;
  const mfaEnabled = user?.mfaEnabled ?? false;

  const handleSetupMfa = async () => {
    setMfaError('');
    setMfaSuccess('');
    setMfaLoading(true);
    try {
      const result = await setupMfa({});
      if (result.error) throw new Error(result.error.message);
      setSetupData(result.data.setupMfa);
    } catch (err: any) {
      setMfaError(err.message || 'Failed to set up MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError('');
    setMfaLoading(true);
    try {
      const result = await verifyMfaSetup({ code: verifyCode });
      if (result.error) throw new Error(result.error.message);
      setMfaSuccess('MFA has been enabled successfully.');
      setSetupData(null);
      setVerifyCode('');
      reexecuteMe({ requestPolicy: 'network-only' });
    } catch (err: any) {
      setMfaError(err.message || 'Invalid verification code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError('');
    setMfaLoading(true);
    try {
      const result = await disableMfa({ password: disablePassword });
      if (result.error) throw new Error(result.error.message);
      setMfaSuccess('MFA has been disabled.');
      setShowDisable(false);
      setDisablePassword('');
      reexecuteMe({ requestPolicy: 'network-only' });
    } catch (err: any) {
      setMfaError(err.message || 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword !== confirmNewPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    setPwLoading(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.error) throw new Error(result.error.message);
      setPwSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>

      {/* MFA Required Banner */}
      {mfaRequiredBanner && !mfaEnabled && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            Your administrator requires you to enable two-factor authentication. Please set up MFA below to continue using the application.
          </p>
        </div>
      )}

      {/* Change Password Section */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Password</h3>

        {pwError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{pwError}</p>}
        {pwSuccess && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{pwSuccess}</p>}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="input-field max-w-sm"
              placeholder="Current password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="input-field max-w-sm"
              placeholder="New password"
            />
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">At least 10 characters with uppercase, lowercase, and a digit.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              className="input-field max-w-sm"
              placeholder="Confirm new password"
            />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary text-sm">
            {pwLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* MFA Section */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Two-Factor Authentication</h3>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
          {mfaEnabled ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              Disabled
            </span>
          )}
        </div>

        {mfaError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{mfaError}</p>}
        {mfaSuccess && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{mfaSuccess}</p>}

        {/* Setup flow */}
        {!mfaEnabled && !setupData && (
          <button
            onClick={handleSetupMfa}
            disabled={mfaLoading}
            className="btn-primary text-sm"
          >
            {mfaLoading ? 'Setting up...' : 'Enable MFA'}
          </button>
        )}

        {setupData && (
          <div className="space-y-6">
            {/* QR Code */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <div className="flex justify-center bg-white p-4 rounded-lg inline-block">
                <img src={setupData.qrCodeDataUri} alt="MFA QR Code" className="w-48 h-48" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Manual entry key: <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{setupData.secret}</code>
              </p>
            </div>

            {/* Backup Codes */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Backup Codes</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                Save these codes in a safe place. Each code can only be used once.
              </p>
              <div className="grid grid-cols-2 gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                {setupData.backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono text-gray-800 dark:text-gray-200">{code}</code>
                ))}
              </div>
            </div>

            {/* Verify */}
            <form onSubmit={handleVerifySetup} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enter a code from your authenticator app to verify:
                </label>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  required
                  className="input-field max-w-xs text-center text-lg tracking-widest"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={mfaLoading} className="btn-primary text-sm">
                  {mfaLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSetupData(null); setVerifyCode(''); setMfaError(''); }}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Disable flow */}
        {mfaEnabled && !showDisable && (
          <button
            onClick={() => { setShowDisable(true); setMfaError(''); setMfaSuccess(''); }}
            className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
          >
            Disable MFA
          </button>
        )}

        {showDisable && (
          <form onSubmit={handleDisableMfa} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enter your password to confirm:
              </label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                className="input-field max-w-xs"
                placeholder="Your password"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={mfaLoading} className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-700 text-white">
                {mfaLoading ? 'Disabling...' : 'Confirm Disable'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDisable(false); setDisablePassword(''); setMfaError(''); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
