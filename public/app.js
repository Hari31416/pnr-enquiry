const el = id => document.getElementById(id);
const pnr = el("pnr");
const status = el("status");
const result = el("result");
const probe = el("probe");

function showResult(data) {
  if (data.errorMessage && data.errorMessage !== "0") {
    status.textContent = String(data.errorMessage);
    return;
  }

  const summary = el("summary");
  summary.replaceChildren();
  const train = [data.trainNumber ?? data.trainNo, data.trainName].filter(Boolean).join(" · ");
  const route = [data.sourceStation ?? data.fromStation, data.destinationStation ?? data.toStation];
  for (const value of [train, route.every(Boolean) ? route.join(" → ") : "", data.chartStatus]) {
    if (typeof value !== "string" || !value) continue;
    const line = document.createElement("p");
    line.textContent = value;
    summary.append(line);
  }
  if (Array.isArray(data.passengerList)) {
    const list = document.createElement("ul");
    for (const [index, passenger] of data.passengerList.entries()) {
      const current = passenger?.currentStatusDetails ?? passenger?.currentStatus;
      if (typeof current !== "string" || !current) continue;
      const item = document.createElement("li");
      item.textContent = `Passenger ${index + 1} · ${current}`;
      list.append(item);
    }
    if (list.childElementCount) summary.append(list);
  }
  result.querySelector("details").open = !summary.childElementCount;
  el("response").textContent = JSON.stringify(data, null, 2);
  result.hidden = false;
  status.textContent = "";
}

async function run(body, pending) {
  const controls = [pnr, el("check"), probe];
  controls.forEach(control => { control.disabled = true; });
  result.hidden = true;
  status.textContent = pending;
  try {
    const response = await fetch("/api/pnr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json();
    if (!response.ok) {
      status.textContent = payload.error || "The lookup failed. Try again.";
    } else if (payload.connected) {
      status.textContent = "Indian Railways responded and the CAPTCHA was readable. You can try a PNR lookup.";
    } else {
      showResult(payload.data);
    }
  } catch {
    status.textContent = "Could not complete the lookup. Try again or use the official enquiry.";
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
}

pnr.addEventListener("input", () => {
  result.hidden = true;
  status.textContent = "";
});

el("lookup").addEventListener("submit", event => {
  event.preventDefault();
  void run({ pnr: pnr.value }, "Checking reservation status…");
});
probe.addEventListener("click", () => {
  void run({ probe: true }, "Testing the railway connection…");
});
