import { Link, useLocation, useNavigate } from 'react-router';
import { Search, Menu, LogOut, User as UserIcon } from 'lucide-react';
import { openCommandPalette } from '@/hooks/useCommandPalette';
import { NotificationCenter } from '@/components/NotificationCenter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { screenTitleFor } from '@/lib/screenTitles';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

/** Topbar do shell (spec req 3-5): marca, tenant, nome da tela, Cmd+K, notificações, avatar. */
export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { companyName } = useCompany();
  const { user, logout } = useAuth();
  const screen = screenTitleFor(location.pathname);

  const initials = (user?.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="vyd-topbar">
      {/* Hambúrguer mobile — só aparece ≤640 (quando o leftrail some) */}
      <button
        type="button"
        className="vyd-topbar__navbtn items-center justify-center p-1.5 rounded-md hover:bg-muted"
        style={{ color: 'var(--vyd-text-primary)' }}
        aria-label="Abrir menu de navegação"
        onClick={onOpenNav}
      >
        <Menu size={20} />
      </button>

      <Link to="/app" className="vyd-topbar__brand" style={{ color: 'var(--vyd-text-primary)' }}>
        VYD Engage
      </Link>

      {companyName && (
        <span className="text-sm truncate max-w-40" style={{ color: 'var(--vyd-text-secondary)' }}>
          · {companyName}
        </span>
      )}
      <span aria-hidden="true" style={{ color: 'var(--vyd-text-disabled)' }}>
        /
      </span>
      <span className="text-sm font-medium truncate" style={{ color: 'var(--vyd-text-primary)' }}>
        {screen}
      </span>

      <span className="vyd-topbar__spacer" />

      {/* Gatilho do Command Palette (Cmd+K continua funcionando via listener global) */}
      <button
        type="button"
        className="vyd-tool-switcher"
        onClick={openCommandPalette}
        title="Buscar ações e leads (Ctrl+K)"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Buscar</span>
        <kbd
          className="hidden sm:inline text-[10px] px-1 rounded"
          style={{
            background: 'var(--vyd-bg-canvas)',
            color: 'var(--vyd-text-secondary)',
            border: 'var(--vyd-border-hairline) solid var(--vyd-border-default)',
          }}
        >
          Ctrl K
        </kbd>
      </button>

      <ThemeToggle />
      <NotificationCenter />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="vyd-avatar" aria-label="Menu do usuário">
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="truncate">{user?.name || 'Usuário'}</div>
            <div className="text-xs font-normal text-muted-foreground truncate">
              {user?.email || ''}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/app/profile')}>
            <UserIcon size={16} className="mr-2" />
            Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut size={16} className="mr-2" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
