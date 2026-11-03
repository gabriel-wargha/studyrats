import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign up" };

// useSearchParams (for ?next=) needs a Suspense boundary so the page stays static.
export default function SignUpPage() {
  return (
    <Suspense fallback={<main className="flex-1" aria-busy="true" />}>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
