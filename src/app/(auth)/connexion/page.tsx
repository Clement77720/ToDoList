import { AuthForm } from "@/components/AuthForm";
import { signInAction } from "@/app/auth-actions";

export default function ConnexionPage() {
  return <AuthForm mode="connexion" action={signInAction} />;
}
