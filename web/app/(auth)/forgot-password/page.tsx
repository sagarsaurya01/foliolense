import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Reset password · FolioLense" };

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" />;
}
