import { checkRailway, RailwayError } from "../lib/railway.js";

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return reply({ error: "Expected a JSON request." }, 415);
  }

  const body = await request.json().catch(() => null);
  const probe = body?.probe === true && body.pnr === undefined;
  if (!probe && (typeof body?.pnr !== "string" || !/^[0-9]{10}$/.test(body.pnr))) {
    return reply({ error: "Enter a 10-digit PNR." }, 400);
  }

  try {
    const data = await checkRailway(probe ? undefined : body.pnr);
    return probe ? reply({ connected: true }) : reply({ data });
  } catch (error) {
    const message = error instanceof RailwayError
      ? error.message
      : "The railway request could not be completed. Try again or use the official enquiry.";
    return reply({ error: message }, 502);
  }
}
