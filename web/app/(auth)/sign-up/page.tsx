import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Create account · FolioLense" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
