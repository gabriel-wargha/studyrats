import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { MobileContainer } from "@/components/mobile-container";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <MobileContainer as="main">
      <Suspense fallback={<div className="min-h-dvh" aria-hidden />}>
        <AuthForm mode="sign-up" />
      </Suspense>
    </MobileContainer>
  );
}
