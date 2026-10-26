import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "New password · FolioLense" };

export default function UpdatePasswordPage() {
  return <AuthForm mode="update" />;
}
