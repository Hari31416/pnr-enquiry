import { clearHistory, currentStatus, isPnr, passengerId, readHistory, saveCheck, statusGroup } from "./history.js";
import { drawHistory, formatTime, passengerChecks } from "./charts.js";
import { node, renderTicket, ticketSnapshot } from "./ticket.js";

const el = id => document.getElementById(id);
const pnr = el("pnr");
const status = el("status");
const result = el("result");
const savedPnr = el("saved-pnr");
const refresh = el("refresh-saved");
const refreshStatus = el("refresh-status");
const savedPassenger = el("saved-passenger");
const clear = el("clear-history");

let history = {};
let selectedPnr = "";
let shown;
try {
  history = readHistory(localStorage);
} catch {
  el("storage-note").textContent = "Saved history is unavailable in this browser.";
}

function showResult(number, check, raw) {
  shown = { number, saved: raw === undefined };
  el("result-title").textContent = raw === undefined ? "Saved ticket status" : "Ticket status";
  el("result-meta").textContent = `PNR ${number} · Checked ${formatTime(check.at)}`;
  renderTicket(check.data, el("summary"));
  el("response").textContent = raw === undefined ? "" : JSON.stringify(raw, null, 2);
  el("response-details").hidden = raw === undefined;
  el("response-details").open = false;
  result.hidden = false;
}

function updateHistory() {
  const entries = Object.entries(history).sort((a, b) => b[1][0].at - a[1][0].at);
  el("history").hidden = !entries.length;
  if (!entries.length) return;
  if (!history[selectedPnr]) selectedPnr = entries[0][0];

  savedPnr.replaceChildren(...entries.map(([number, checks]) => {
    const latestData = checks[0]?.data;
    const trainNum = latestData?.trainNumber || latestData?.trainNo || "";
    const name = latestData?.trainName || "";
    const label = [trainNum, name].filter(Boolean).join(" · ");
    return new Option(label ? `${label} (${number})` : `PNR ${number}`, number);
  }));
  savedPnr.value = selectedPnr;

  const previous = savedPassenger.value;
  const ids = new Set();
  const checks = history[selectedPnr] || [];
  for (const { data } of checks) {
    if (Array.isArray(data.passengerList)) {
      data.passengerList.forEach((passenger, index) => ids.add(passengerId(passenger, index)));
    }
  }
  const idList = Array.from(ids);
  savedPassenger.replaceChildren(...idList.map(id => new Option(`Passenger ${id}`, id)));
  if (ids.has(previous)) {
    savedPassenger.value = previous;
  } else if (idList.length > 0) {
    savedPassenger.value = idList[0];
  }

  el("passenger-picker").hidden = ids.size < 2;
  el("history-charts").hidden = !ids.size;
  updateCharts();
}

function updateCharts() {
  const checks = history[selectedPnr];
  if (!checks || !checks.length) return;
  const id = savedPassenger.value || "1";
  drawHistory(checks, id, el("timeline"), el("queue-chart"));
  const rows = passengerChecks(checks, id).map(({ passenger }, index) => {
    const row = node("tr");
    const check = checks[index];
    if (!check) return row;
    const open = node("button", formatTime(check.at), "text-button table-date-btn");
    open.type = "button";
    open.addEventListener("click", () => {
      pnr.value = selectedPnr;
      status.textContent = "";
      status.className = "lookup-status";
      showResult(selectedPnr, check);
      el("result-title").focus();
    });
    const timeTd = node("td");
    timeTd.append(open);

    const st = currentStatus(passenger) || "Unavailable";
    const statusTd = node("td");
    const statusPill = node("span", st, "table-status-pill");
    statusPill.dataset.status = statusGroup(st);
    statusTd.append(statusPill);

    const chartTd = node("td");
    const chartVal = String(check.data?.chartStatus || "—");
    const isPrep = /prepared/i.test(chartVal) && !/not\s*prepared/i.test(chartVal);
    const chartPill = node("span", chartVal, `chart-badge ${isPrep ? "chart-prepared" : "chart-unprepared"}`);
    chartTd.append(chartPill);

    row.append(timeTd, statusTd, chartTd);
    return row;
  });
  el("check-rows").replaceChildren(...rows);
}

async function run(number, message = status) {
  const controls = [pnr, el("check"), savedPnr, refresh, savedPassenger, clear];
  controls.forEach(control => { control.disabled = true; });
  status.textContent = "";
  status.className = "lookup-status";
  refreshStatus.textContent = "";
  refreshStatus.className = "lookup-status";
  message.className = "lookup-status loading";
  message.textContent = "Checking reservation status…";
  try {
    const response = await fetch("/api/pnr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pnr: number }),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json();
    if (!response.ok) {
      message.className = "lookup-status error";
      message.textContent = payload.error || "The lookup failed. Try again.";
    } else if (payload.data?.errorMessage && payload.data.errorMessage !== "0") {
      message.className = "lookup-status error";
      message.textContent = String(payload.data.errorMessage);
    } else if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      const check = { at: Date.now(), data: ticketSnapshot(payload.data) };
      pnr.value = number;
      showResult(number, check, payload.data);
      message.className = "lookup-status success";
      message.textContent = "Ticket status updated.";
      try {
        history = saveCheck(localStorage, number, check);
      } catch {
        message.className = "lookup-status error";
        message.textContent = "Ticket status updated, but this browser could not save the check.";
        return;
      }
      try {
        selectedPnr = number;
        updateHistory();
      } catch (err) {
        console.error("Failed to update history UI:", err);
      }
    } else {
      message.className = "lookup-status error";
      message.textContent = "Indian Railways returned an unexpected response.";
    }
  } catch {
    message.className = "lookup-status error";
    message.textContent = "Could not complete the lookup. Try again or use the official enquiry.";
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
}

const pnrCount = el("pnr-count");
pnr.addEventListener("input", () => {
  pnr.value = pnr.value.replace(/\D/g, "").slice(0, 10);
  if (pnrCount) {
    pnrCount.textContent = pnr.value.length ? `${pnr.value.length}/10` : "";
  }
  if (shown?.number !== pnr.value) result.hidden = true;
  status.textContent = "";
  status.className = "lookup-status";
});

const copyJsonBtn = el("copy-json");
if (copyJsonBtn) {
  copyJsonBtn.addEventListener("click", async () => {
    const jsonText = el("response").textContent;
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
      const originalText = copyJsonBtn.textContent;
      copyJsonBtn.textContent = "Copied!";
      setTimeout(() => { copyJsonBtn.textContent = originalText; }, 2000);
    } catch {
      copyJsonBtn.textContent = "Failed to copy";
    }
  });
}

el("lookup").addEventListener("submit", event => {
  event.preventDefault();
  if (isPnr(pnr.value)) void run(pnr.value);
});
refresh.addEventListener("click", () => {
  if (history[selectedPnr]) void run(selectedPnr, refreshStatus);
});
savedPnr.addEventListener("change", () => {
  refreshStatus.textContent = "";
  selectedPnr = savedPnr.value;
  pnr.value = selectedPnr;
  status.textContent = "";
  showResult(selectedPnr, history[selectedPnr][0]);
  updateHistory();
});
savedPassenger.addEventListener("change", updateCharts);
clear.addEventListener("click", () => {
  if (!window.confirm("Clear all saved PNR checks from this browser?")) return;
  try {
    clearHistory(localStorage);
    refreshStatus.textContent = "";
    history = {};
    selectedPnr = "";
    if (shown?.saved) {
      result.hidden = true;
      shown = undefined;
    }
    updateHistory();
    status.textContent = "Saved checks cleared.";
    pnr.focus();
  } catch {
    el("storage-note").textContent = "Saved history could not be cleared in this browser.";
  }
});

updateHistory();
