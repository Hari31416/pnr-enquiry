import { PNG } from "pngjs";
import { CookieJar } from "tough-cookie";
import { solveCaptcha } from "./captcha.js";

const BASE = "https://www.indianrail.gov.in/enquiry/";
const REFERER = new URL("PNR/PnrEnquiry.html?locale=en", BASE).href;

export class RailwayError extends Error {}

async function railwayRequest(path, jar, signal) {
  const url = new URL(path, BASE);
  const headers = {
    "User-Agent": "Mozilla/5.0",
    "X-Requested-With": "XMLHttpRequest",
    Referer: REFERER,
  };
  const cookie = await jar.getCookieString(url.href);
  if (cookie) headers.Cookie = cookie;

  let response;
  try {
    response = await fetch(url, { headers, signal, redirect: "error" });
  } catch {
    throw new RailwayError("Could not connect to Indian Railways. Try again or use the official enquiry.");
  }
  if (!response.ok) {
    throw new RailwayError(`Indian Railways returned HTTP ${response.status}. Try again or use the official enquiry.`);
  }

  for (const value of response.headers.getSetCookie()) {
    await jar.setCookie(value, url.href, { ignoreError: true });
  }
  return response;
}

async function startChallenge(signal) {
  const jar = new CookieJar();
  const setup = await railwayRequest("CaptchaConfig", jar, signal);
  await setup.text();
  const image = await railwayRequest(`captchaDraw.png?${Date.now()}`, jar, signal);
  const bytes = Buffer.from(await image.arrayBuffer());

  // Limit image dimensions before passing the upstream response to the decoder.
  if (bytes.length < 24 || bytes.length > 256_000 ||
      bytes.readUInt32BE(16) > 800 || bytes.readUInt32BE(20) > 300) {
    throw new RailwayError("Indian Railways returned an unexpected challenge image.");
  }

  let png;
  try {
    png = PNG.sync.read(bytes);
  } catch {
    throw new RailwayError("Indian Railways returned an unreadable challenge image.");
  }
  return { jar, answer: solveCaptcha(png) };
}

export async function checkRailway(pnr) {
  const signal = AbortSignal.timeout(22_000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { jar, answer } = await startChallenge(signal);
    if (answer === null) continue;

    const query = new URLSearchParams({
      inputCaptcha: answer,
      inputPnrNo: pnr,
      inputPage: "PNR",
      language: "en",
    });
    const response = await railwayRequest(`CommonCaptcha?${query}`, jar, signal);
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new RailwayError("Indian Railways returned an unreadable lookup response.");
    }
    if (typeof data.errorMessage === "string" && /captcha/i.test(data.errorMessage)) continue;
    return data;
  }
  throw new RailwayError("Could not complete the railway CAPTCHA. Try again or use the official enquiry.");
}
