const paths = {
  feed: 'M4 6h16M4 12h16M4 18h16',
  like: 'M12 21s-6.4-4.54-9.2-8.69C1.1 10.37 2.35 6.9 5.2 6.4A4.4 4.4 0 0 1 12 9.25 4.4 4.4 0 0 1 18.8 6.4c2.85.5 4.1 3.97 2.4 5.91C18.4 16.46 12 21 12 21z',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 8l-4-4-4 4M12 4v16',
  refresh: 'M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9m18 0a9 9 0 0 0-9-9 9 9 0 0 0-8.94 8',
  search: 'M11 19a8 8 0 1 1 5.293-2.293L21 21',
  messages: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 4h10M7 13h6',
  groups: 'M7 20v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M9 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm-4 6a4 4 0 0 1 3-3.87',
  live: 'M5 3 19 12 5 21 5 3z',
  marketplace: 'M4 7h16l-1 11H5L4 7zm4 0V5a4 4 0 0 1 8 0v2',
  jobs: 'M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2m4 0h-20l1 13h18l1-13z',
  network: 'M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm8-3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm3 8a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-11 6a3 3 0 1 1 6 0 3 3 0 0 1-6 0z',
  calendar: 'M6 4V2m12 2V2m-12 6h12m-14 12h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  support: 'M12 22s8-4 8-10V7l-8-5-8 5v5c0 6 8 10 8 10z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8.5-3a1.5 1.5 0 0 0 0-3l-1.86-.3a6.9 6.9 0 0 0-.78-1.88l.9-1.7a1.5 1.5 0 0 0-2.06-2.06l-1.7.9a6.9 6.9 0 0 0-1.88-.78L13 1.5a1.5 1.5 0 0 0-3 0L9.7 3.36a6.9 6.9 0 0 0-1.88.78l-1.7-.9a1.5 1.5 0 0 0-2.06 2.06l.9 1.7a6.9 6.9 0 0 0-.78 1.88L1.5 9a1.5 1.5 0 0 0 0 3l1.86.3a6.9 6.9 0 0 0 .78 1.88l-.9 1.7a1.5 1.5 0 0 0 2.06 2.06l1.7-.9a6.9 6.9 0 0 0 1.88.78L9 22.5a1.5 1.5 0 0 0 3 0l.3-1.86a6.9 6.9 0 0 0 1.88-.78l1.7.9a1.5 1.5 0 0 0 2.06-2.06l-.9-1.7a6.9 6.9 0 0 0 .78-1.88z',
  projects: 'M4 6h16v12H4z M4 10h16',
  hires: 'M4 7h16v10H4zm4 0V5h8v2',
  documents: 'M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
  briefcase: 'M4 7h16v12H4z M9 7V5a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v2',
  wallet: 'M3 7h18v12H3z M3 11h18',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  agency: 'M4 20V7l8-4 8 4v13',
  team: 'M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M9 9a3 3 0 1 1 6 0',
  pipeline: 'M3 5h18v4H3zm0 6h18v4H3zm0 6h10v4H3z',
  building: 'M6 2h12v20H6z M6 8h12',
  candidates: 'M4 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M8 8a4 4 0 1 1 8 0',
  mandates: 'M4 4h16l-2 16H6L4 4zm4 0V2h8v2',
  submissions: 'M5 3h14v18H5z M9 7h6M9 11h6M9 15h6',
  commissions: 'M4 7h16v10H4zm4-4h8v4H8z',
  overview: 'M4 13h4v7H4zm6-6h4v13h-4zm6-4h4v17h-4z',
  users: 'M3 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2M7 7a4 4 0 1 1 8 0',
  orgs: 'M4 4h16v16H4z M9 4V2h6v2',
  content: 'M4 5h16v4H4zm0 6h16v8H4z',
  payments: 'M3 6h18v12H3zm0 4h18',
  disputes: 'M12 2 2 20h20L12 2zm0 7v5m0 4h.01',
  moderation: 'M5 5h14v14H5z M9 9h6v6H9z',
  audit: 'M5 4h14l-2 16H7L5 4zm4 6h6',
  earnings: 'M4 12h16M12 4v16',
  notification: 'M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-4-5.65V4a2 2 0 1 0-4 0v1.35A6 6 0 0 0 6 11v5L4 18v1h16v-1z',
  theme: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',
  chevronDown: 'M6 9l6 6 6-6',
  bell: 'M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3z M10 21h4',
  grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  media: 'M4 5h16v14H4z M8 9h.01M4 17l4-4 3 3 4-4 5 6',
  link: 'M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1',
  celebrate: 'M12 2.5l2.2 4.46 4.92.72-3.56 3.47.84 4.9L12 13.92l-4.4 2.33.84-4.9L4.88 7.68l4.92-.72L12 2.5z',
  insight: 'M12 3a5 5 0 0 1 5 5c0 2-1.2 3.7-3 4.5V15h-4v-2.5c-1.8-.8-3-2.5-3-4.5a5 5 0 0 1 5-5zM10 21h4M9 17h6',
  heart: 'M12 21s-6.4-4.54-9.2-8.69C1.1 10.37 2.35 6.9 5.2 6.4A4.4 4.4 0 0 1 12 9.25 4.4 4.4 0 0 1 18.8 6.4c2.85.5 4.1 3.97 2.4 5.91C18.4 16.46 12 21 12 21z',
  bookmark: 'M6 3h12v18l-6-4-6 4V3z',
  send: 'M22 2 11 13 8 10 2 22 5 14 11 20 22 2z',
}

export function Icon({ name, size = 20, strokeWidth = 1.6, className }) {
  const path = paths[name]
  if (!path) return null
  const isPolygon = path.includes('z') || path.includes('Z')
  const children = path.split(' ').some((segment) => segment.includes('M') && segment.includes('z'))
    ? path
    : undefined
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children ? <path d={path} /> : <path d={path} />}
    </svg>
  )
}

export default Icon
