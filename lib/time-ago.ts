/** Short relative time such as "5 min ago". Pure so the server and client agree. */
export function timeAgo(then: Date | string | number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(then).getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(then).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Boise",
  });
}
