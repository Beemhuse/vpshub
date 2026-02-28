import { useEffect, useState } from 'react';
import api from '@/services/api';

export function GithubCallback() {
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    // if (!code) {
    //   setStatus('Missing code in callback');
    //   return;
    // }

    (async () => {
      try {
        await api.post('/auth/github/exchange', { code });
        setStatus('GitHub connected successfully. You can close this tab.');
        // Notify opener (popup flow) so UI can react immediately
        try {
          if (window.opener && typeof window.opener.postMessage === 'function') {
            window.opener.postMessage({ type: 'github_connected' }, window.location.origin ?? '*');
          }
        } catch (e) {
          // ignore
        }
        // Optionally close the window if opened as popup
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            // Ignore if window.close() fails (e.g. not opened as popup)
          }
        }, 1200);
      } catch (e) {
        console.error(e);
        setStatus('Failed to complete GitHub connection');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark">
      <div className="p-6 bg-dark-100 border border-white/10 rounded-xl">
        <h2 className="text-lg font-semibold mb-2">GitHub OAuth</h2>
        <p>{status}</p>
      </div>
    </div>
  );
}
