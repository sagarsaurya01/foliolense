import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <header className="top">
        <div className="top-in pad">
          <Logo />
        </div>
      </header>
      {children}
    </div>
  );
}
