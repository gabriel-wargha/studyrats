import type { Metadata } from "next";
import { CreateGroupForm } from "@/components/create-group-form";
import { PageHeader, pageShell } from "@/components/ui";

export const metadata: Metadata = { title: "Create a group" };

export default function NewGroupPage() {
  return (
    <main className={pageShell}>
      <PageHeader title="Create a group" back={{ href: "/groups", label: "Back to groups" }}>
        <p className="mt-3 max-w-[34ch] text-base leading-6 text-muted">
          You get an invite code to share as soon as the group exists.
        </p>
      </PageHeader>
      <CreateGroupForm />
    </main>
  );
}
