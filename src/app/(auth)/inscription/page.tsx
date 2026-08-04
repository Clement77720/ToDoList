import { AuthForm } from "@/components/AuthForm";
import { signUpAction } from "@/app/auth-actions";

export default function InscriptionPage() {
  return <AuthForm mode="inscription" action={signUpAction} />;
}
