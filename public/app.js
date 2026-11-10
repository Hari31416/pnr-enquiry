import { clearHistory, currentStatus, isPnr, passengerId, readHistory, saveCheck } from "./history.js";
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
    const name = checks[0].data.trainName;
    return new Option(name ? `${number} · ${name}` : number, number);
  }));
  savedPnr.value = selectedPnr;

  const previous = savedPassenger.value;
  const ids = new Set();
  const checks = history[selectedPnr];
  for (const { data } of checks) {
    if (Array.isArray(data.passengerList)) data.passengerList.forEach((passenger, index) => ids.add(passengerId(passenger, index)));
  }
  savedPassenger.replaceChildren(...Array.from(ids, id => new Option(`Passenger ${id}`, id)));
  if (ids.has(previous)) savedPassenger.value = previous;
  el("passenger-picker").hidden = ids.size < 2;
  el("history-charts").hidden = !ids.size;
  updateCharts();
}

function updateCharts() {
  const checks = history[selectedPnr];
  const id = savedPassenger.value;
  drawHistory(checks, id, el("timeline"), el("queue-chart"));
  const rows = passengerChecks(checks, id).map(({ passenger }, index) => {
    const row = node("tr");
    const check = checks[index];
    const open = node("button", formatTime(check.at), "text-button");
    open.type = "button";
    open.addEventListener("click", () => {
      pnr.value = selectedPnr;
      status.textContent = "";
      showResult(selectedPnr, check);
      el("result-title").focus();
    });
    const time = node("td");
    time.append(open);
    row.append(time, node("td", currentStatus(passenger) || "Unavailable"), node("td", check.data.chartStatus || "—"));
    return row;
  });
  el("check-rows").replaceChildren(...rows);
}

async function run(number, message = status) {
  const controls = [pnr, el("check"), savedPnr, refresh, savedPassenger, clear];
  controls.forEach(control => { control.disabled = true; });
  status.textContent = "";
  refreshStatus.textContent = "";
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
      message.textContent = payload.error || "The lookup failed. Try again.";
    } else if (payload.data?.errorMessage && payload.data.errorMessage !== "0") {
      message.textContent = String(payload.data.errorMessage);
    } else if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      const check = { at: Date.now(), data: ticketSnapshot(payload.data) };
      pnr.value = number;
      showResult(number, check, payload.data);
      message.textContent = "Ticket status updated.";
      try {
        history = saveCheck(localStorage, number, check);
        selectedPnr = number;
        updateHistory();
      } catch {
        message.textContent = "Ticket status updated, but this browser could not save the check.";
      }
    } else {
      message.textContent = "Indian Railways returned an unexpected response.";
    }
  } catch {
    message.textContent = "Could not complete the lookup. Try again or use the official enquiry.";
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
}

pnr.addEventListener("input", () => {
  if (shown?.number !== pnr.value) result.hidden = true;
  status.textContent = "";
});

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
