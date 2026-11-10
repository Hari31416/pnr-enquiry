import { currentStatus, passengerId, reservationStatus, statusGroup } from "./history.js";

const BERTH_NAMES = {
  LB: "Lower Berth",
  MB: "Middle Berth",
  UB: "Upper Berth",
  SL: "Side Lower",
  SU: "Side Upper",
  SM: "Side Middle",
  WS: "Window Seat",
  CB: "Cabin",
  CP: "Coupe",
};

export function berthFullName(code) {
  if (!code) return "";
  const upper = String(code).trim().toUpperCase();
  return BERTH_NAMES[upper] ? `${BERTH_NAMES[upper]} (${upper})` : String(code);
}

const fields = {
  train: ["trainNumber", "trainNo"],
  name: ["trainName"],
  from: ["sourceStation", "fromStation"],
  to: ["destinationStation", "toStation"],
  "Journey date": ["dateOfJourney", "journeyDate"],
  "Boarding date": ["boardingDate"],
  "Boarding point": ["boardingPoint", "boardingStation"],
  "Reserved up to": ["reservationUpto", "reservedUpto", "reservationUpTo"],
  Class: ["journeyClass", "classCode", "reservationClass", "class"],
  Quota: ["quota", "quotaCode", "bookingQuota"],
  "Chart status": ["chartStatus"],
  "Train status": ["trainStatus", "trainCancelStatus"],
  "Total fare": ["ticketFare", "totalFare", "bookingFare", "fare"],
  "Booking date": ["bookingDate"],
  "Ticket type": ["ticketType"],
  Remarks: ["informationMessage", "remarks", "remark"],
};
const passengerFields = {
  serialNumber: ["passengerSerialNumber", "serialNumber"],
  bookingStatusDetails: ["bookingStatusDetails"],
  bookingStatus: ["bookingStatus"],
  bookingStatusIndex: ["bookingStatusIndex"],
  currentStatusDetails: ["currentStatusDetails"],
  currentStatus: ["currentStatus"],
  currentStatusIndex: ["currentStatusIndex"],
  "Booking coach": ["bookingCoachId", "bookingCoach"],
  "Booking berth": ["bookingBerthNo", "bookingBerth"],
  "Booking berth type": ["bookingBerthCode", "bookingBerthType"],
  Coach: ["currentCoachId", "currentCoach", "coachId", "coachNo"],
  Berth: ["currentBerthNo", "currentBerth", "berthNo"],
  "Berth type": ["currentBerthCode", "currentBerthType", "berthType"],
  Quota: ["passengerQuota", "bookingQuota", "quota"],
  "Coach position": ["passengerCoachPosition"],
};

function fieldValue(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (key === "informationMessage" && Array.isArray(value)) {
      const notes = value.filter(item => typeof item === "string" && item.trim()).map(item => item.trim());
      if (notes.length) return notes.join(" · ");
    }
    if (typeof value === "string" && value.trim() && value.trim() !== "--") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

// Save the displayed ticket fields, rather than any unrecognized fields in the upstream response.
export function ticketSnapshot(data) {
  const copyFields = (source, groups) => Object.fromEntries(
    Object.values(groups).flat().flatMap(key => {
      const value = fieldValue(source, [key]);
      return value === undefined ? [] : [[key, value]];
    }),
  );
  return {
    ...copyFields(data, fields),
    passengerList: Array.isArray(data.passengerList)
      ? data.passengerList.map(passenger => copyFields(passenger, passengerFields))
      : [],
  };
}

export function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
const fareFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function formatField(label, value) {
  if (label === "Total fare" && /^\d+(?:\.\d+)?$/.test(String(value))) return fareFormat.format(Number(value));
  if (label.endsWith("date") && (typeof value === "number" || /^\d{4}-\d{2}-\d{2}/.test(value))) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return dateFormat.format(date);
  }
  if (label === "Chart status") {
    const str = String(value);
    const isPrepared = /prepared/i.test(str) && !/not\s*prepared/i.test(str);
    const pill = node("span", str, `chart-badge ${isPrepared ? "chart-prepared" : "chart-unprepared"}`);
    return pill;
  }
  if (label.includes("berth type") || label.includes("Berth type")) {
    return berthFullName(value);
  }
  return value;
}

function appendFields(parent, data, entries) {
  const list = node("dl", undefined, "facts");
  for (const [label, keys] of entries) {
    const value = fieldValue(data, keys);
    if (value === undefined || (/berth|coach/i.test(label) && ["0", "-1"].includes(String(value)))) continue;
    const item = node("div");
    item.append(node("dt", label));
    const formatted = formatField(label, value);
    const dd = node("dd");
    if (formatted instanceof Node) {
      dd.append(formatted);
    } else {
      dd.textContent = formatted;
    }
    item.append(dd);
    list.append(item);
  }
  if (list.childElementCount) parent.append(list);
}

export function renderTicket(data, summary) {
  const [train, name, from, to] = ["train", "name", "from", "to"].map(key => fieldValue(data, fields[key]));
  const journey = node("div", undefined, "journey");
  
  const journeyHeader = node("div", undefined, "journey-header");
  if (train !== undefined || name !== undefined) {
    const trainBadge = node("span", [train, name].filter(value => value !== undefined).join(" · "), "train-badge");
    journeyHeader.append(trainBadge);
  }
  journey.append(journeyHeader);

  if (from || to) {
    const routeWrap = node("div", undefined, "route-wrap");
    if (from && to) {
      const fromEl = node("span", from, "route-station");
      const arrowEl = node("span", "→", "route-arrow");
      const toEl = node("span", to, "route-station");
      routeWrap.append(fromEl, arrowEl, toEl);
    } else {
      routeWrap.append(node("span", from || to, "route-station"));
    }
    journey.append(routeWrap);
  }

  appendFields(journey, data, Object.entries(fields).slice(4));
  summary.replaceChildren(journey);

  if (!Array.isArray(data.passengerList) || !data.passengerList.length) return;
  
  const headingWrap = node("div", undefined, "passenger-header-wrap");
  headingWrap.append(node("h3", `Passengers (${data.passengerList.length})`, "passenger-heading"));
  summary.append(headingWrap);

  const passengers = node("div", undefined, "passengers");
  for (const [index, passenger] of data.passengerList.entries()) {
    const card = node("article", undefined, "passenger");
    const status = currentStatus(passenger) || "Unavailable";
    const heading = node("div", undefined, "passenger-title");
    const badge = node("span", status, "passenger-status");
    badge.dataset.status = statusGroup(status);
    heading.append(node("h4", `Passenger ${passengerId(passenger, index)}`), badge);
    card.append(heading);

    const coach = fieldValue(passenger, passengerFields.Coach);
    const berth = fieldValue(passenger, passengerFields.Berth);
    const berthType = fieldValue(passenger, passengerFields["Berth type"]);

    if (coach && berth) {
      const seatSpotlight = node("div", undefined, "seat-spotlight");
      const coachCell = node("div", undefined, "seat-cell");
      coachCell.append(node("span", "Coach", "seat-label"), node("strong", String(coach), "seat-val"));
      const berthCell = node("div", undefined, "seat-cell");
      berthCell.append(node("span", "Berth", "seat-label"), node("strong", String(berth), "seat-val"));
      const typeCell = node("div", undefined, "seat-cell");
      typeCell.append(node("span", "Berth type", "seat-label"), node("strong", berthType ? berthFullName(berthType) : "—", "seat-val"));
      seatSpotlight.append(coachCell, berthCell, typeCell);
      card.append(seatSpotlight);
    }

    const booked = reservationStatus(passenger, "booking");
    const bookingQueue = ["waitlist", "rac"].includes(statusGroup(booked)) && !fieldValue(passenger, passengerFields["Booking coach"]);
    const currentQueue = ["waitlist", "rac"].includes(statusGroup(status)) && !fieldValue(passenger, passengerFields.Coach);
    
    // If seat spotlight is shown, don't repeat current Coach, Berth, Berth type in the dl
    const details = Object.entries(passengerFields).slice(7).filter(([label]) => {
      if (coach && berth && ["Coach", "Berth", "Berth type"].includes(label)) return false;
      if (bookingQueue && label.startsWith("Booking berth")) return false;
      if (currentQueue && label.startsWith("Berth")) return false;
      return true;
    });

    appendFields(card, { ...passenger, booked }, [["Booked as", ["booked"]], ...details]);
    passengers.append(card);
  }
  summary.append(passengers);
}
