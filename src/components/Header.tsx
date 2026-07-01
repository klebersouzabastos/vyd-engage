interface HeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Banda de título da página (dentro do .vyd-canvas do shell).
 * O chrome global — busca (Cmd+K), tema, notificações e logout — vive na topbar
 * do shell (spec ribbon-shell-global req 3-4); este componente ficou só com o
 * título/subtítulo da tela.
 */
export function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="px-4 md:px-8 py-4 border-b border-gray-300">
      <h1 className="text-gray-900">{title}</h1>
      {subtitle && <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>}
    </div>
  );
}
