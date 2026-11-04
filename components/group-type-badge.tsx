import type { GroupType } from "@/server/groups";

const label: Record<GroupType, string> = { friends: "Friends", class: "Class" };

export function GroupTypeBadge({ type }: { type: GroupType }) {
  const tone = type === "class" ? "bg-chalk text-paper" : "bg-highlighter text-ink";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${tone}`}>
      {label[type]}
    </span>
  );
}
