import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchUserOrganizationsByEmail, loginWithOrgEmailPassword } from '../api/authClient';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [orgResponse, setOrgResponse] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [password, setPassword] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [error, setError] = useState('');

  const location = useLocation();

  const canFind = useMemo(() => email && !loadingOrgs, [email, loadingOrgs]);
  const canLogin = useMemo(
    () => email && selectedOrgId && password && !loadingLogin,
    [email, selectedOrgId, password, loadingLogin]
  );

  async function handleFindOrgs() {
    setError('');
    if (!email) {
      setError('Please enter an email to look up organizations.');
      return;
    }
    setLoadingOrgs(true);
    try {
      const resp = await fetchUserOrganizationsByEmail(email);
      setOrgResponse(resp);
      const items = Array.isArray(resp?.organizations) ? resp.organizations : [];
      if (items.length === 0) {
        setSelectedOrgId('');
        setError('No organizations found for this email.');
      } else {
        const auto = items[0];
        setSelectedOrgId(auto?.id || '');
      }
    } catch (e) {
      setError(e.message || 'Failed to fetch organizations. Please try again.');
      setOrgResponse(null);
      setSelectedOrgId('');
    } finally {
      setLoadingOrgs(false);
    }
  }

  function handleOrganizationSelect(e) {
    setSelectedOrgId(e.target.value);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!email || !selectedOrgId || !password) {
      setError('Please provide email, organization and password.');
      return;
    }
    setLoadingLogin(true);
    try {
      await loginWithOrgEmailPassword({
        organizationId: selectedOrgId,
        email,
        password,
      });
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next') || '/';
      window.location.replace(next);
    } catch (e) {
      const status = e?.status;
      if (status === 401 || status === 403) {
        setError('Invalid credentials. Please check your email, organization, and password.');
      } else if (status === 404) {
        setError('Login endpoint not found or user not found.');
      } else {
        setError(e.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoadingLogin(false);
    }
  }

  return (
    <div className="login-page">
      <form onSubmit={handleLogin}>
        <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <button type="button" onClick={handleFindOrgs} disabled={!canFind}>
          {loadingOrgs ? 'Finding…' : 'Find Organizations'}
        </button>
        <select value={selectedOrgId} onChange={handleOrganizationSelect}>
          <option value="">Select organization...</option>
          {(orgResponse?.organizations || []).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <input placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={!canLogin}>{loadingLogin ? 'Signing in…' : 'Login'}</button>
      </form>
    </div>
  );
}