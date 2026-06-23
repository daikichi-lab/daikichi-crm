// ミニ・アイコンセット（24x24 ストローク）— mockups/assets/app.js から移植
export const ICONS: Record<string, string> = {
  home: 'M3 11.2 12 4l9 7.2M5.5 9.8V20h13V9.8',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 21V9h4a1 1 0 0 1 1 1v11M3 21h18M7 8h4M7 12h4M7 16h4',
  card: 'M3 6h18v12H3zM3 10h18M6.5 14h5',
  link: 'M9 12h6M10 8.5H8a3.5 3.5 0 0 0 0 7h2M14 8.5h2a3.5 3.5 0 0 1 0 7h-2',
  handshake: 'M5 13l3-3 4 3 4-4 3 3M4 9l4-3 4 3M12 12v6M8 18h8',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5 19 5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c0-3.5 3-6 7-6s7 2.5 7 6',
  search: 'M11 11m-7 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0M21 21l-5-5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 1.8',
  pulse: 'M3 12h3.5l2.2-6 4 13 2.4-7H21',
  phone: 'M5 4h4l1.6 5L8 11a12 12 0 0 0 5 5l2-2.6 5 1.6v4a2 2 0 0 1-2.2 2A16 16 0 0 1 3 6.2 2 2 0 0 1 5 4',
  check: 'M5 12.5l4.2 4L19 6',
  folder: 'M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  doc: 'M7 3h10v18H7zM9 8h6M9 12h6M9 16h4',
  inbox: 'M4 5h16v14H4zM4 13h6l1 2h2l1-2h6',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9a2.4 2.4 0 1 1 3.2 2.3c-.7.3-1.3.8-1.3 1.7M12 16.5h.01',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  send: 'M4 12l16-7-6 16-3-7-7-2z',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.2a3.5 3.5 0 0 1 0 6.8M17.5 14.5c2.3.5 3.5 2.3 3.5 5',
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const d = ICONS[name] ?? ICONS.home;
  return (
    <svg
      className={['ic', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d
        .split('M')
        .filter(Boolean)
        .map((s, i) => (
          <path key={i} d={'M' + s} />
        ))}
    </svg>
  );
}
