import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { MobileContainer } from "@/components/mobile-container";

export const metadata: Metadata = { title: "Log in" };

export default function SignInPage() {
  return (
    <MobileContainer as="main">
      <Suspense fallback={<div className="min-h-dvh" aria-hidden />}>
        <AuthForm mode="sign-in" />
      </Suspense>
    </MobileContainer>
  );
}
