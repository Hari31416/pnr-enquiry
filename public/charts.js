import { currentStatus, passengerId, queuePosition, statusGroup } from "./history.js";

const SVG = "http://www.w3.org/2000/svg";
const shortTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fullTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

export const formatTime = time => fullTime.format(time);

function svg(tag, attributes, label) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (label !== undefined && label !== null) node.textContent = String(label);
  return node;
}

export function passengerChecks(checks, id) {
  return checks.map(check => ({
    at: check.at,
    check,
    passenger: Array.isArray(check?.data?.passengerList)
      ? check.data.passengerList.find((passenger, index) => passengerId(passenger, index) === id)
      : undefined,
  }));
}

export function drawHistory(checks, id, chartOrTimeline, maybeChart) {
  const chart = maybeChart || chartOrTimeline;
  if (maybeChart && chartOrTimeline?.replaceChildren) {
    chartOrTimeline.replaceChildren();
  }
  chart.replaceChildren();
  if (!id) return;
  const observations = passengerChecks(checks, id).reverse();

  const points = observations.map(({ passenger, at, check }) => {
    const position = queuePosition(passenger);
    let status = currentStatus(passenger);
    if (!status && position) {
      status = position.position === 0 ? position.queue : `${position.queue}/${position.position}`;
    }
    return position ? { ...position, at, status, check } : null;
  });
  const positions = points.filter(Boolean);
  if (!positions.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty-state";
    const title = document.createElement("strong");
    title.className = "chart-empty-title";
    title.textContent = "No queue position recorded";
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "RAC, waitlist, and confirmed positions will be plotted here if reported.";
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
  const getQueueColor = queue => {
    if (queue === "CNF") return "#175b36";
    const nonCnf = queues.filter(q => q !== "CNF");
    const idx = nonCnf.indexOf(queue);
    return colors[(idx >= 0 ? idx : 0) % colors.length];
  };
  const width = 620, height = 188, left = 40, right = 18, top = 17, bottom = 40;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const firstTime = observations[0].at, lastTime = observations.at(-1).at;
  const hasConfirmed = positions.some(point => point.position === 0);
  const min = hasConfirmed ? 0 : 1;
  const max = Math.max(min + 2, ...positions.map(point => point.position));
  const x = (time, index) => left + (firstTime === lastTime
    ? index / (observations.length - 1) : (time - firstTime) / (lastTime - firstTime)) * plotWidth;
  // A lower queue number is better, so it is drawn higher. Confirmed is queue 0 at the top.
  const y = position => top + (position - min) / (max - min) * plotHeight;

  const graphic = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Queue position over time. Hover or tap points to see status and time.",
  });
  const midTick = Math.round((max + min) / 2);
  for (const tick of new Set([min, midTick, max])) {
    graphic.append(
      svg("line", { x1: left, x2: width - right, y1: y(tick), y2: y(tick), class: "grid-line" }),
      svg("text", { x: left - 8, y: y(tick) + 4, "text-anchor": "end" }, tick),
    );
  }
  graphic.append(
    svg("text", { x: left, y: height - 11 }, shortTime.format(firstTime)),
    svg("text", { x: width - right, y: height - 11, "text-anchor": "end" }, shortTime.format(lastTime)),
  );

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    const color = getQueueColor(point.queue);
    const previous = points[i - 1];
    const cx = x(point.at, i), cy = y(point.position);
    if (previous && (previous.queue === point.queue || point.position === 0)) {
      graphic.append(svg("line", {
        x1: x(previous.at, i - 1),
        y1: y(previous.position),
        x2: cx,
        y2: cy,
        stroke: point.position === 0 ? getQueueColor("CNF") : color,
        "stroke-width": 2.5,
      }));
    }
  }

  const hoverGuide = svg("g", { class: "chart-hover-elements", opacity: "0" });
  const hoverLine = svg("line", {
    x1: 0,
    x2: 0,
    y1: top,
    y2: height - bottom,
    class: "chart-hover-line",
  });
  const hoverHalo = svg("circle", { cx: 0, cy: 0, r: 10, class: "chart-hover-halo" });
  const hoverDot = svg("circle", { cx: 0, cy: 0, r: 5.5, class: "chart-hover-dot" });
  hoverGuide.append(hoverLine, hoverHalo, hoverDot);
  graphic.append(hoverGuide);

  const validPoints = [];
  for (const [index, point] of points.entries()) {
    if (!point) continue;
    const cx = x(point.at, index);
    const cy = y(point.position);
    const color = getQueueColor(point.queue);
    const isConfirmed = point.position === 0;
    const item = { ...point, cx, cy, color, index, isConfirmed };
    validPoints.push(item);

    if (isConfirmed) {
      const group = svg("g", {
        class: "chart-dot chart-confirmed-badge",
        tabindex: "0",
        role: "button",
        "aria-label": `${point.status} (Confirmed) at ${formatTime(point.at)}`,
      });
      const bg = svg("circle", {
        cx,
        cy,
        r: 7.5,
        fill: color,
        stroke: "#fffdf8",
        "stroke-width": 1.5,
        class: "chart-confirmed-bg",
      });
      const checkmark = svg("path", {
        d: `M ${cx - 3.2} ${cy + 0.2} L ${cx - 0.8} ${cy + 2.6} L ${cx + 3.2} ${cy - 2}`,
        fill: "none",
        stroke: "#fffdf8",
        "stroke-width": 1.75,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "chart-confirmed-check",
      });
      group.append(bg, checkmark);
      group.append(svg("title", {}, `${point.status} · ${formatTime(point.at)}`));
      group.addEventListener("focus", () => showHover(item));
      group.addEventListener("blur", hideHover);
      graphic.append(group);
    } else {
      const circle = svg("circle", {
        cx,
        cy,
        r: 4.5,
        fill: color,
        class: "chart-dot",
        tabindex: "0",
        role: "button",
        "aria-label": `${point.status} at ${formatTime(point.at)}`,
      });
      circle.append(svg("title", {}, `${point.status} · ${formatTime(point.at)}`));
      circle.addEventListener("focus", () => showHover(item));
      circle.addEventListener("blur", hideHover);
      graphic.append(circle);
    }
  }

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;

  const tooltipBadge = document.createElement("span");
  tooltipBadge.className = "status-pill";

  const tooltipTime = document.createElement("time");
  tooltipTime.className = "chart-tooltip-time";

  tooltip.append(tooltipBadge, tooltipTime);

  function showHover(point) {
    tooltipBadge.textContent = point.status;
    tooltipBadge.dataset.status = statusGroup(point.status);
    tooltipTime.textContent = shortTime.format(point.at);
    tooltipTime.dateTime = new Date(point.at).toISOString();

    const leftPct = (point.cx / width) * 100;
    const topPct = (point.cy / height) * 100;
    tooltip.style.left = `${leftPct}%`;
    tooltip.style.top = `${topPct}%`;

    let xOffset = "-50%";
    if (point.cx < 70) {
      xOffset = "-10%";
    } else if (point.cx > width - 70) {
      xOffset = "-90%";
    }

    if (point.cy < 65) {
      tooltip.style.transform = `translate(${xOffset}, 12px)`;
    } else {
      tooltip.style.transform = `translate(${xOffset}, calc(-100% - 12px))`;
    }

    tooltip.hidden = false;

    hoverLine.setAttribute("x1", point.cx);
    hoverLine.setAttribute("x2", point.cx);
    hoverHalo.setAttribute("cx", point.cx);
    hoverHalo.setAttribute("cy", point.cy);
    hoverHalo.setAttribute("stroke", point.color);
    hoverHalo.setAttribute("r", point.isConfirmed ? "12" : "10");
    hoverDot.setAttribute("cx", point.cx);
    hoverDot.setAttribute("cy", point.cy);
    hoverDot.setAttribute("fill", point.color);
    hoverDot.setAttribute("opacity", point.isConfirmed ? "0" : "1");
    hoverGuide.setAttribute("opacity", "1");
  }

  function hideHover() {
    tooltip.hidden = true;
    hoverGuide.setAttribute("opacity", "0");
  }

  function getSvgCoords(event) {
    if (graphic.createSVGPoint && graphic.getScreenCTM) {
      try {
        const pt = graphic.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const ctm = graphic.getScreenCTM();
        if (ctm) return pt.matrixTransform(ctm.inverse());
      } catch {}
    }
    const rect = graphic.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  }

  function findClosestPoint(svgX) {
    let closest = validPoints[0];
    let minDistance = Math.abs(closest.cx - svgX);
    for (let i = 1; i < validPoints.length; i++) {
      const dist = Math.abs(validPoints[i].cx - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closest = validPoints[i];
      }
    }
    return closest;
  }

  function onPointerMove(event) {
    const coords = getSvgCoords(event);
    if (!coords) return;
    if (coords.x < left - 30 || coords.x > width - right + 30 || coords.y < top - 30 || coords.y > height + 20) {
      hideHover();
      return;
    }
    const closest = findClosestPoint(coords.x);
    if (closest) showHover(closest);
  }

  graphic.addEventListener("pointermove", onPointerMove);
  graphic.addEventListener("pointerdown", onPointerMove);
  graphic.addEventListener("pointerleave", hideHover);

  if (chart._abortController) {
    chart._abortController.abort();
  }
  chart._abortController = new AbortController();
  document.addEventListener("pointerdown", event => {
    if (!chart.contains(event.target)) {
      hideHover();
    }
  }, { signal: chart._abortController.signal });

  const legend = document.createElement("p");
  legend.className = "chart-legend note";
  queues.forEach(queue => {
    const entry = document.createElement("span");
    entry.style.setProperty("--queue-color", getQueueColor(queue));
    if (queue === "CNF") {
      entry.className = "chart-legend-confirmed";
      entry.textContent = "CNF (Confirmed)";
    } else {
      entry.textContent = queue;
    }
    legend.append(entry);
  });
  chart.append(graphic, tooltip, legend);
}
