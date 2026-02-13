import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'urql';
import { useAuth } from '../contexts/AuthContext';
import { LOGIN_MUTATION, REGISTER_MUTATION } from '../graphql/mutations';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [, loginMutation] = useMutation(LOGIN_MUTATION);
  const [, registerMutation] = useMutation(REGISTER_MUTATION);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        const result = await registerMutation({ email, password, name: name || undefined });
        if (result.error) throw new Error(result.error.message);
        const { token, user } = result.data.register;
        login(token, user);
      } else {
        const result = await loginMutation({ email, password });
        if (result.error) throw new Error(result.error.message);
        const { token, user } = result.data.login;
        login(token, user);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Your name" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field" placeholder="••••••••" />
            </div>

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
