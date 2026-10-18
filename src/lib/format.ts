export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function daysLeft(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function rewardEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("coffee")) return "☕";
  if (t.includes("cookie")) return "🍪";
  if (t.includes("gift")) return "🎁";
  if (t.includes("bread") || t.includes("loaf") || t.includes("bakery")) return "🥖";
  return "🥚";
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(iso: string): string {
  return WEEKDAYS[new Date(iso).getUTCDay()] ?? "Unknown";
}
