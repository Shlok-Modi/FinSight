import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';

/**
 * Loads the Google Identity Services script once and resolves when ready.
 */
function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const existing = document.getElementById('gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.accounts.id));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.accounts.id);
    script.onerror = () => reject(new Error('Failed to load Google Sign-In script.'));
    document.head.appendChild(script);
  });
}

export default function GoogleSignInModal({ onClose, onSignIn, clientId }) {
  const btnRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | signing_in | error | unconfigured
  const [errorMsg, setErrorMsg] = useState('');

  const isConfigured = clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE' && clientId.includes('.apps.googleusercontent.com');

  useEffect(() => {
    if (!isConfigured) {
      setStatus('unconfigured');
      return;
    }

    let cancelled = false;

    loadGsiScript()
      .then((gid) => {
        if (cancelled) return;

        gid.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          callback: async (response) => {
            console.log('[GoogleAuth] Credential response received from GIS:', response);
            if (!response.credential) {
              console.error('[GoogleAuth] GIS callback did not return a credential:', response);
              setErrorMsg('Google did not return a credential. Please check browser console.');
              setStatus('error');
              return;
            }
            setStatus('signing_in');
            try {
              const { user } = await signInWithGoogle(response.credential);
              console.log('[GoogleAuth] User signed in successfully:', user);
              onSignIn(user);
              onClose();
            } catch (err) {
              console.error('[GoogleAuth] Backend verification failed:', err);
              setErrorMsg(err.message || 'Sign-in failed. Please try again.');
              setStatus('error');
            }
          },
          error_callback: (err) => {
            console.error('[GoogleAuth] GIS error_callback triggered:', err);
            setErrorMsg(`Google Auth Error (${err.type || 'GIS_ERROR'}). Check console.`);
            setStatus('error');
          },
          auto_select: false,
          cancel_on_tap_outside: false,
        });

        setStatus('ready');

        setTimeout(() => {
          if (cancelled) return;
          try {
            if (btnRef.current) {
              gid.renderButton(btnRef.current, {
                type: 'standard',
                shape: 'rectangular',
                theme: 'outline',
                text: 'signin_with',
                size: 'large',
                logo_alignment: 'center',
                width: 280,
              });
            }
          } catch (e) {
            setErrorMsg('Render error: ' + e.message);
            setStatus('error');
          }
        }, 100);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err.message);
          setStatus('error');
        }
      });

    return () => { cancelled = true; };
  }, [clientId, isConfigured]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 100000,
        }}
      />

      {/* Modal card */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100001,
        width: '360px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-secondary)',
        borderRadius: '16px',
        padding: '36px 32px 28px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0',
        animation: 'modal-slide-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute', top: '14px', right: '14px',
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            padding: '4px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          className="list-item-hover"
        >
          <X size={16} />
        </button>

        {/* Google "G" logo */}
        <div style={{ marginBottom: '20px' }}>
          <svg viewBox="0 0 24 24" width="40" height="40">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px',
          color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          letterSpacing: '-0.02em',
        }}>
          Sign in with Google
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 28px', textAlign: 'center' }}>
          to continue to <strong style={{ color: 'var(--text-primary)' }}>FinSight</strong>
        </p>

        {/* State: unconfigured */}
        {status === 'unconfigured' && (
          <div style={{
            width: '100%', padding: '16px', borderRadius: '10px',
            backgroundColor: 'rgba(251,188,5,0.08)',
            border: '1px solid rgba(251,188,5,0.25)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FBBC05', fontWeight: 700, fontSize: '0.8rem' }}>
              <AlertCircle size={15} /> Google Auth Not Configured
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Add your <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', backgroundColor: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>GOOGLE_CLIENT_ID</code> to{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', backgroundColor: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>module1-server/.env</code> and restart the server.
            </p>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-dimmed)', margin: 0 }}>
              Get it at:{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#4285F4' }}
              >
                console.cloud.google.com
              </a>
            </p>
          </div>
        )}

        {/* State: loading */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
            <div style={{
              width: '28px', height: '28px',
              border: '2.5px solid var(--border-secondary)',
              borderTopColor: '#4285F4',
              borderRadius: '50%',
              animation: 'pulse-subtle 0.9s infinite linear',
            }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Loading Google Sign-In...
            </span>
          </div>
        )}

        {/* State: signing in */}
        {status === 'signing_in' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
            <div style={{
              width: '28px', height: '28px',
              border: '2.5px solid var(--border-secondary)',
              borderTopColor: '#4285F4',
              borderRadius: '50%',
              animation: 'pulse-subtle 0.9s infinite linear',
            }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Verifying with Google...
            </span>
          </div>
        )}

        {/* State: error */}
        {status === 'error' && (
          <div style={{
            width: '100%', padding: '14px', borderRadius: '10px',
            backgroundColor: 'rgba(234,67,53,0.06)',
            border: '1px solid rgba(234,67,53,0.25)',
            display: 'flex', flexDirection: 'column', gap: '8px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EA4335', fontWeight: 700, fontSize: '0.78rem' }}>
              <AlertCircle size={14} /> Sign-in failed
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{errorMsg}</p>
            <button
              type="button"
              onClick={() => setStatus('ready')}
              style={{
                alignSelf: 'flex-start', fontSize: '0.68rem', fontWeight: 600,
                padding: '4px 10px', borderRadius: '4px',
                border: '1px solid var(--border-secondary)',
                backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer',
              }}
              className="list-item-hover"
            >
              Try again
            </button>
          </div>
        )}

        {/* State: ready — rendered button container */}
        {status === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <div ref={btnRef} style={{ minHeight: '44px', display: 'flex', justifyContent: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--text-dimmed)' }}>
              <ShieldCheck size={13} color="#34A853" /> Secured by Google Identity & Neon DB
            </div>
          </div>
        )}
      </div>
    </>
  );
}
