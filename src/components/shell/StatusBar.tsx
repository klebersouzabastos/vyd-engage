import { useEffect, useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { APP_VERSION } from '@/lib/appVersion';

/** Statusbar do shell (spec req 16): tenant + online/offline + versão. */
export function StatusBar() {
  const { companyName } = useCompany();
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <footer className="vyd-statusbar" role="contentinfo">
      <span className="vyd-mono">{companyName || 'VYD Engage'}</span>
      <span className="vyd-statusbar__spacer" />
      <span className="inline-flex items-center gap-2" title={online ? 'Online' : 'Offline'}>
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 rounded-full"
          style={{
            background: online ? 'var(--vyd-success)' : 'var(--vyd-text-disabled)',
          }}
        />
        {online ? 'Online' : 'Offline'}
      </span>
      <span>{APP_VERSION}</span>
    </footer>
  );
}
