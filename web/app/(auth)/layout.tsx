import Link from "next/link";

function Mark({ size = 30 }: { size?: number }) {
  return (
    <span className="auth-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d="M4 15l4-4 3 3 5-6 4 4" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-hero">
        <svg className="auth-hero-curve" viewBox="0 0 400 600" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="fl-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f5c4e" stopOpacity="0.45" />
              <stop offset="1" stopColor="#1f5c4e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,470 C60,450 90,400 150,410 C210,420 240,330 300,305 C345,286 380,235 400,210 L400,600 L0,600 Z" fill="url(#fl-fade)" />
          <path d="M0,470 C60,450 90,400 150,410 C210,420 240,330 300,305 C345,286 380,235 400,210" fill="none" stroke="var(--accent)" strokeWidth="2" strokeOpacity="0.6" />
        </svg>

        <div className="auth-hero-in">
          <Link href="/" className="auth-logo" aria-label="FolioLense home">
            <Mark size={30} />
            Folio<b>Lense</b>
          </Link>

          <div className="auth-hero-mid">
            <h2>
              Your family&rsquo;s wealth,
              <br />
              in one clear view.
            </h2>
            <p>Every holding across every member — valued, reconciled and tax-ready.</p>

            <div className="auth-stat">
              <span className="auth-stat-label">Family net worth</span>
              <span className="auth-stat-row">
                <b>₹1.42 Cr</b>
                <em>▲ 12.4%</em>
              </span>
            </div>

            <ul className="auth-points">
              <li><i>•</i> Equity, mutual funds and F&amp;O together</li>
              <li><i>•</i> True cost, XIRR and capital gains</li>
              <li><i>•</i> Import CAS, contract notes and tradebooks</li>
            </ul>
          </div>

          <p className="auth-hero-foot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Private to your family · built on your own data
          </p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-main-top">
          <Link href="/" className="auth-logo sm" aria-label="FolioLense home">
            <Mark size={24} />
            Folio<b>Lense</b>
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
