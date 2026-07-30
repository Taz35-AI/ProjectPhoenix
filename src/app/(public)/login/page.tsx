import { AuthForm } from "@/components/phoenix/auth-form";
import { signIn } from "@/server/auth";

export const metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="phoenix-horizon pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <AuthForm mode="signin" action={signIn} next={searchParams.next} />
      </div>
    </main>
  );
}
