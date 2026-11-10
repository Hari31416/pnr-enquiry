import { currentStatus, passengerId, queuePosition, statusGroup } from "./history.js";

const SVG = "http://www.w3.org/2000/svg";
const shortTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fullTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

export const formatTime = time => fullTime.format(time);

function svg(tag, attributes, label) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (label) node.textContent = label;
  return node;
}

export function passengerChecks(checks, id) {
  return checks.map(({ at, data }) => ({
    at,
    passenger: Array.isArray(data.passengerList)
      ? data.passengerList.find((passenger, index) => passengerId(passenger, index) === id)
      : undefined,
  }));
}

export function drawHistory(checks, id, timeline, chart) {
  timeline.replaceChildren();
  chart.replaceChildren();
  if (!id) return;
  const observations = passengerChecks(checks, id).reverse();

  for (const { at, passenger } of observations) {
    const status = currentStatus(passenger) || "Unavailable";
    const item = document.createElement("li");
    item.className = "timeline-item";
    item.dataset.status = statusGroup(status);

    const badge = document.createElement("span");
    badge.className = "timeline-badge";
    badge.dataset.status = statusGroup(status);
    badge.textContent = status;

    const time = document.createElement("time");
    time.className = "timeline-time";
    time.dateTime = new Date(at).toISOString();
    time.textContent = shortTime.format(at);
    time.title = formatTime(at);

    item.append(badge, time);
    timeline.append(item);
  }

  const points = observations.map(({ passenger, at }) => {
    const position = queuePosition(passenger);
    return position ? { ...position, at } : null;
  });
  const positions = points.filter(Boolean);
  if (!positions.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty-state";
    const title = document.createElement("strong");
    title.className = "chart-empty-title";
    title.textContent = "No waitlist position recorded";
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "This passenger has confirmed booking. RAC and waitlist positions will be plotted here if reported.";
    empty.append(title, note);
    chart.append(empty);
    return;
  }
  if (observations.length < 2) {
    const empty = document.createElement("div");
    empty.className = "chart-empty-state";
    const title = document.createElement("strong");
    title.className = "chart-empty-title";
    title.textContent = "Single check recorded";
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Check this PNR again over time to track waitlist position movements.";
    empty.append(title, note);
    chart.append(empty);
    return;
  }

  const queues = [...new Set(positions.map(point => point.queue))];
  const colors = ["#286549", "#a15322", "#305e89", "#734783"];
  const width = 620, height = 188, left = 40, right = 18, top = 17, bottom = 40;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const firstTime = observations[0].at, lastTime = observations.at(-1).at;
  const max = Math.max(3, ...positions.map(point => point.position));
  const x = (time, index) => left + (firstTime === lastTime
    ? index / (observations.length - 1) : (time - firstTime) / (lastTime - firstTime)) * plotWidth;
  // A lower queue number is better, so it is drawn higher.
  const y = position => top + (position - 1) / (max - 1) * plotHeight;

  const graphic = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Queue position over time. The table below lists the exact statuses for each check.",
  });
  for (const tick of new Set([1, Math.ceil(max / 2), max])) {
    graphic.append(
      svg("line", { x1: left, x2: width - right, y1: y(tick), y2: y(tick), class: "grid-line" }),
      svg("text", { x: left - 8, y: y(tick) + 4, "text-anchor": "end" }, tick),
    );
  }
  graphic.append(
    svg("text", { x: left, y: height - 11 }, shortTime.format(firstTime)),
    svg("text", { x: width - right, y: height - 11, "text-anchor": "end" }, shortTime.format(lastTime)),
  );

  for (const [index, point] of points.entries()) {
    if (!point) continue;
    const color = colors[queues.indexOf(point.queue) % colors.length];
    const previous = points[index - 1];
    const cx = x(point.at, index), cy = y(point.position);
    if (previous?.queue === point.queue) {
      graphic.append(svg("line", { x1: x(previous.at, index - 1), y1: y(previous.position),
        x2: cx, y2: cy, stroke: color, "stroke-width": 2.5 }));
    }
    const circle = svg("circle", { cx, cy, r: 4.5, fill: color });
    circle.append(svg("title", {}, `${point.queue}/${point.position} · ${formatTime(point.at)}`));
    graphic.append(circle);
  }
  const legend = document.createElement("p");
  legend.className = "chart-legend note";
  queues.forEach((queue, index) => {
    const entry = document.createElement("span");
    entry.style.setProperty("--queue-color", colors[index % colors.length]);
    entry.textContent = queue;
    legend.append(entry);
  });
  chart.append(graphic, legend);
}
