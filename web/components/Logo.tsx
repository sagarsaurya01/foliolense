import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="FolioLense home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M7 13.5l2.6-2.6 2 2 3.4-4" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 17l6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      Folio<b>Lense</b>
    </Link>
  );
}
