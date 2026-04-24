import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'urql';
import { useAuth } from '../contexts/AuthContext';
import { LOGIN_MUTATION, REGISTER_MUTATION, VERIFY_MFA_LOGIN_MUTATION } from '../graphql/mutations';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const [, loginMutation] = useMutation(LOGIN_MUTATION);
  const [, registerMutation] = useMutation(REGISTER_MUTATION);
  const [, verifyMfaLogin] = useMutation(VERIFY_MFA_LOGIN_MUTATION);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        const result = await registerMutation({ email, password, name: name || undefined });
        if (result.error) throw new Error(result.error.message);
        const { token, user, message } = result.data.register;
        if (token) {
          login(token, user);
        } else {
          setSuccessMessage(message);
          setIsRegister(false);
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setName('');
          return;
        }
      } else {
        const result = await loginMutation({ email, password });
        if (result.error) throw new Error(result.error.message);
        const { token, user, mfaRequired, mfaSetupRequired, mfaToken: mToken } = result.data.login;

        if (mfaRequired) {
          setMfaStep(true);
          setMfaToken(mToken);
          return;
        }

        login(token, user);

        if (mfaSetupRequired) {
          navigate('/settings?mfa=required');
          return;
        }
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result = await verifyMfaLogin({ mfaToken, code: mfaCode });
      if (result.error) throw new Error(result.error.message);
      const { token, user } = result.data.verifyMfaLogin;
      login(token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid MFA code');
    }
  };

  if (mfaStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">OCI Visualizer</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Two-factor authentication</p>
          </div>

          <div className="card">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter the 6-digit code from your authenticator app, or use a backup code.
            </p>

            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Authentication Code</label>
                <input
                  id="mfa-code"
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  autoFocus
                  className="input-field text-center text-lg tracking-widest"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button type="submit" className="btn-primary w-full">Verify</button>

              <button
                type="button"
                onClick={() => {
                  setMfaStep(false);
                  setMfaToken('');
                  setMfaCode('');
                  setError('');
                }}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Back to login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">OCI Visualizer</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Visualize your Oracle Cloud infrastructure</p>
        </div>

        <div className="card">
          {/* Tab switcher */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${!isRegister ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >Login</button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${isRegister ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >Register</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Your name" />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field" placeholder="••••••••" />
            </div>
            {isRegister && (
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="input-field" placeholder="••••••••" />
              </div>
            )}

            {successMessage && <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button type="submit" className="btn-primary w-full">
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
