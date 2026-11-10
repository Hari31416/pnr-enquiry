const KEY = "pnr-enquiry.history.v1";
const MAX_TICKETS = 20;
const MAX_CHECKS = 40;
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export const isPnr = value => typeof value === "string" && /^[0-9]{10}$/.test(value);

export function readHistory(storage, now = Date.now()) {
  const saved = JSON.parse(storage.getItem(KEY) ?? "{}");
  if (!saved || typeof saved !== "object") return {};
  const tickets = Object.entries(saved).flatMap(([pnr, checks]) => {
    if (!isPnr(pnr) || !Array.isArray(checks)) return [];
    const recent = checks.filter(check => check && Number.isFinite(check.at) &&
      check.at >= now - MAX_AGE && check.at <= now &&
      check.data && typeof check.data === "object" && !Array.isArray(check.data))
      .sort((a, b) => b.at - a.at).slice(0, MAX_CHECKS);
    return recent.length ? [[pnr, recent]] : [];
  });
  return Object.fromEntries(tickets.sort((a, b) => b[1][0].at - a[1][0].at).slice(0, MAX_TICKETS));
}

export function saveCheck(storage, pnr, check) {
  const saved = readHistory(storage, check.at);
  const checks = [check, ...(saved[pnr] ?? [])].slice(0, MAX_CHECKS);
  delete saved[pnr];
  const otherTickets = Object.entries(saved).sort((a, b) => b[1][0].at - a[1][0].at);
  const history = Object.fromEntries([[pnr, checks], ...otherTickets].slice(0, MAX_TICKETS));
  storage.setItem(KEY, JSON.stringify(history));
  return history;
}

export function clearHistory(storage) {
  storage.removeItem(KEY);
}

export function reservationStatus(passenger, type = "current") {
  const detail = passenger?.[`${type}StatusDetails`];
  const status = passenger?.[`${type}Status`];
  const value = [detail, status].find(item => typeof item === "string" && item.trim())?.trim() ?? "";
  // The enquiry API uses the berth field for a queue number when no coach is assigned.
  const coach = passenger?.[`${type}CoachId`] ?? passenger?.[`${type}Coach`];
  const berth = !coach ? passenger?.[`${type}BerthNo`] : undefined;
  const index = [passenger?.[`${type}StatusIndex`], berth].map(String).find(item => /^[1-9][0-9]*$/.test(item));
  return /^(?:[A-Z]*WL|RAC)$/i.test(value) && index ? `${value}/${index}` : value;
}

export const currentStatus = passenger => reservationStatus(passenger);

export function passengerId(passenger, index) {
  return String(passenger?.passengerSerialNumber ?? passenger?.serialNumber ?? index + 1);
}

export function statusGroup(status) {
  if (/^(?:CNF|CONFIRMED)\b/i.test(status)) return "confirmed";
  if (/^RAC\b/i.test(status)) return "rac";
  if (/^(?:[A-Z]*WL|WAIT\s*LIST(?:ED)?)\b/i.test(status)) return "waitlist";
  if (/^(?:CAN|CANCELLED|CAN\/MOD|WEBCAN)\b/i.test(status)) return "cancelled";
  return "other";
}

export function queuePosition(passenger) {
  // A detailed confirmed status can contain a coach or berth number.
  const detail = currentStatus(passenger);
  const raw = typeof passenger?.currentStatus === "string" ? passenger.currentStatus.trim() : "";
  const match = /^([A-Z]*WL|RAC)(?:\s*[/ -]\s*|\s+)(\d+)(?:\b|$)/i.exec(detail) ??
    (/^(?:[A-Z]*WL|RAC)$/i.test(detail) ? /^([A-Z]*WL|RAC)\s*[/ -]?\s*(\d+)$/i.exec(raw) : null);
  if (!match) return null;
  const position = Number(match[2]);
  return Number.isSafeInteger(position) && position > 0 ? { queue: match[1].toUpperCase(), position } : null;
}
