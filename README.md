# AI-Powered Automation Platform — React + Node.js

A complete no-code automation platform (Zapier/Make style) with a plain-English
**AI Command Center**. Users write a command, the server parses it into a
trigger + conditions + actions workflow, the user reviews/edits and approves
it, and a real execution engine runs it — with integrations, a scheduler, and
a **WhatsApp webhook for auto-replies**.

This is the standalone code version of the hosted Automation Platform.
**There is no payment gateway in this project** (it is an automation tool,
not a shop).

## How automation actually works here

- **React (client/)** is only the control panel: dashboard, command center,
  builder, history. Closing the browser does not stop automations.
- **Node/Express (server/)** is the engine that runs 24/7:
  - `server/engine.js` runs steps in order (condition → save → WhatsApp →
    email …), retries failed steps up to the automation's retry limit, and
    logs every run with per-step input/output/error/duration.
  - `server/scheduler.js` checks every minute for schedule automations
    (times in Asia/Karachi) and runs the due ones.
  - **Webhooks** receive events from outside services (see below).
- **Database:** a plain JSON file at `server/data/db.json` — a file-based
  store, **not** a hosted database. It ships fresh: 8 templates, 12
  integration catalog entries, **0 users, 0 automations, 0 executions**.
  The first account you register becomes the **admin**; later accounts are
  normal users and get `403` on `/api/admin/*`.

## Run it locally

```bash
# 1) Server (port 5000)
cd server
cp .env.example .env      # set JWT_SECRET and WHATSAPP_VERIFY_TOKEN
npm install
npm start

# 2) Client (port 5173) — in a second terminal
cd client
npm install
npm run dev
```

Open http://localhost:5173, register the first account (it becomes admin),
then open the **AI Command Center** and try:

> When a new order is received, send a WhatsApp notification to the admin.

Review the generated workflow, approve & activate it, then run it from
**My Automations**. The save step writes a real record; the WhatsApp step
fails honestly with “WhatsApp Business API is not connected” until you
connect WhatsApp in **Integrations** — success is never faked.

## Command parsing (AI)

`POST /api/commands/parse` returns a **draft only** — nothing is saved until
you approve it. Parsing works fully **without any AI key** through the
built-in rule/keyword parser in `server/parser.js`, which handles the
documented example commands (contact form, new order + WhatsApp, daily
9 AM summary, customer registration + welcome email, order completed,
WhatsApp auto-reply). If `OPENAI_API_KEY` is set in `server/.env`, the
server tries that API first and falls back to the built-in parser; every
response states which parser was used (`parserSource`).

## WhatsApp auto-reply (webhook flow)

This is the piece that needs the Node server on a **public URL**:

1. Deploy the server (Render steps below) so it has a public address, e.g.
   `https://your-app.onrender.com`.
2. In **Settings**, set a **WhatsApp Verify Token** (any secret string you
   invent — or `WHATSAPP_VERIFY_TOKEN` in `.env`).
3. In the Meta developer app → WhatsApp → Configuration → Webhook:
   - Callback URL: `https://your-app.onrender.com/webhook/whatsapp`
   - Verify token: the same string from step 2
   - Subscribe to the **messages** field.
   Meta calls `GET /webhook/whatsapp` to verify (the server answers the
   challenge when the token matches), then sends every incoming customer
   message to `POST /webhook/whatsapp`.
4. In **Integrations**, connect WhatsApp with your **Phone Number ID** and
   **Permanent Access Token** (verified against Meta at connect time).
5. Create an automation with trigger **“When a WhatsApp message is
   received”** (optionally with a keyword like `price`), a
   `send_whatsapp` step, and your reply text as the step template — use
   `{{message}}`, `{{name}}`, `{{orderId}}` placeholders. Activate it.
6. Now, when a customer messages your WhatsApp number, the server receives
   the webhook, matches the active automation, sends the reply through the
   WhatsApp Cloud API, and logs the run in **Execution History**.

There is also a generic trigger: `POST /webhook/<automationId>` with a JSON
body runs any active automation (for WooCommerce/Shopify/custom forms).

> **Free hosting note:** Render's free tier sleeps after ~15 minutes idle,
> so a webhook can be delayed or missed while the service wakes. For a
> real business auto-reply, use a paid/always-on plan.

## Integrations

12 integrations in **Integrations**: Gmail, Google Sheets, WhatsApp
Business API, Telegram, Discord, Slack, Webhooks, REST APIs, WordPress,
WooCommerce, Shopify, CRM. Credentials are stored **on the server only**
(in `db.json`), never returned in full — the API returns masked values.
Telegram tokens (`getMe`), Discord/Slack webhooks (test post) and WhatsApp
(Meta Graph check) are **verified live at connect time**; an integration is
marked Connected only when verification succeeds, otherwise the error is
shown and it stays disconnected. Other providers have no public
verification endpoint, so their credentials are field-validated on save —
this distinction is also stated in the connect response.

## Auth & password reset

Register/login with scrypt-hashed passwords and signed tokens; protected
routes return `401` when unauthenticated. Password reset uses a server-side
reset code. **Demo mode:** no email provider is configured, so the reset
code is shown in the API response and server log, clearly labelled as demo
— it is never claimed that an email was sent. Connect a real mail provider
before using reset in production.

## Deploy on Render (one service)

`render.yaml` is included: it builds the client, installs the server, and
the server serves the built client itself, so the whole platform runs as
**one web service**. Set `JWT_SECRET` and `WHATSAPP_VERIFY_TOKEN` in the
Render dashboard. Note the free-tier sleep warning above, and that the
JSON database resets if the service's disk is wiped — move to a hosted
database before storing real business data long-term.

## Project structure

```
automation-code/
  README.md, render.yaml
  client/                  Vite + React (port 5173)
    src/App.jsx            routing + shared state ONLY
    src/api.js             API wrapper (token, errors)
    src/constants.js       nav, example commands, step/trigger types
    src/components/Sidebar.jsx
    src/pages/             Dashboard, CommandCenter, MyAutomations,
                           Builder, Integrations, History, Templates,
                           Settings, Profile, Admin, Login, Register
  server/                  Node + Express (port 5000)
    index.js               API routes, webhooks, static client serving
    db.js                  JSON file database (server/data/db.json)
    auth.js                scrypt hashing + signed tokens + guards
    parser.js              natural-language command parser (+ optional AI)
    engine.js              workflow execution engine with retries
    scheduler.js           every-minute schedule checker (Asia/Karachi)
    templates.js           8 templates + 12-integration catalog (seed)
    .env.example           PORT, JWT_SECRET, WHATSAPP_VERIFY_TOKEN, AI keys
```
