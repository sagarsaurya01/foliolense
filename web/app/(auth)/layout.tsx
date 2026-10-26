import { Logo } from "@/components/Logo";
import { ThemeButton } from "@/components/ThemeSwitch";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <header className="top">
        <div className="top-in pad">
          <Logo />
          <nav className="menu">
            <ThemeButton />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
