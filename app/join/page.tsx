import type { Metadata } from "next";
import { JoinCodeForm } from "@/components/join-code-form";
import { PageHeader, pageShell } from "@/components/ui";

export const metadata: Metadata = { title: "Join a group" };

export default function JoinPage() {
  return (
    <main className={pageShell}>
      <PageHeader title="Join a group" back={{ href: "/groups", label: "Back to groups" }}>
        <p className="mt-3 max-w-[34ch] text-base leading-6 text-muted">
          Enter the 8 character code from your group. Capital letters do not matter.
        </p>
      </PageHeader>
      <JoinCodeForm />
    </main>
  );
}
