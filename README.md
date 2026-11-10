# PNR enquiry

A small static page and one Vercel Node.js function. The browser sends a POST to its own origin. The function starts a fresh Indian Railways session, reads the arithmetic CAPTCHA and submits the PNR using the same session cookies. Successful checks are saved in browser local storage, grouped by PNR. The site keeps up to 20 PNRs and 40 checks per PNR, and shows checks from the last 30 days. Clear history removes the saved checks from that browser. Railway session cookies stay in memory for a single request.

## Deploy to Vercel

Import this repository as a new Vercel project. Keep the root directory at the repository root and choose **Other** if prompted for the framework. Vercel reads the static directory and function settings from `vercel.json`. No app environment variables are required.

After deploying, select **Test connection**. This tests whether the deployment can fetch and read a railway CAPTCHA without sending a PNR. Then check a ticket you own. The railway endpoint is unofficial and can change or reject requests from a cloud IP. The page links to the official enquiry if that happens.

For local development, use Node.js 22, run `pnpm install --frozen-lockfile`, then run `pnpm dlx vercel dev` from the repository root.
