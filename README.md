# EggDrop

Businesses pay **$0.05 per egg** to hide a discount or gift card near their shop. Players find eggs through the phone camera and redeem them at the counter with a one-time QR code.

The app is a Next.js PWA. The player side has a map, an AR catch screen, a crack-open reveal, and a wallet. The business side has a dashboard, an egg drop, Stripe Checkout, campaign results, and a scanner.

## Local setup

```bash
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API keys are required for the local demo.

The header switches between **Player** and **Business**. On a fresh seed you are standing outside Bean There Cafe in Hayes Valley. One egg is 42 m away, so it shows up in the camera. An egg at 60 m stays on the map and stays out of the camera until you are within 50 m.

| Side | What to try |
| --- | --- |
| Player | Map → Hunt → tap the egg → wallet → open a reward |
| Business | Dashboard → Hide eggs → pay → results |
| Redeem | Business → Scan, enter `EGG-4F7K-22`, then enter it again |

The second scan is rejected. A code cannot be redeemed twice, and Bean There cannot redeem another shop's code.

`npm run seed` rebuilds three things:

- `.data/db.json`, the local database
- `supabase/seed.sql`, the same demo world as SQL
- the Supabase project, when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

Copy `.env.example` to `.env.local` when you connect Supabase or Stripe. Leave the values blank to stay on the local database.

## How the pieces behave

- **Camera.** The hunt and scan screens call `getUserMedia` with `facingMode: "environment"` (rear camera). The egg is an overlay. If the browser has no camera, the street illustration stays behind the overlay and the chip says "Camera off".
- **Location.** "Use my GPS" watches `navigator.geolocation`. The server only creates a claim when the reported point is within **50 m** of that egg. The demo spot is the fallback so the seed is playable on a laptop.
- **Map.** Leaflet with [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles.
- **Money.** A drop of N eggs is `N × $0.05`. The slider starts at 10 eggs because Stripe's card minimum is $0.50. With no `STRIPE_SECRET_KEY`, confirm runs the same `activateCampaign` path the webhook uses and does not charge a card.
- **Codes.** Each claim stores a human code (`EGG-XXXX-XX`) and a random token in the QR. Redeeming either marks the claim redeemed and inserts one redemption row. The unique constraint on `redemptions.claim_id` blocks a second use.

Browser geolocation can be spoofed. The 50 m check is the product rule, not a proof of physical presence.

## Supabase

1. Create a project.
2. Run `supabase/migrations/20261014000000_init.sql` in the SQL editor (or `supabase db push` if you use the CLI).
3. Put the project URL, anon key, and service role key in `.env.local`.
4. Set `EGG_DATA_DRIVER=supabase`.
5. Run `npm run seed`.

The seed creates two confirmed users:

| Email | Password | Role |
| --- | --- | --- |
| `player@eggdrop.demo` | `eggdrop-demo` | Player (Alex Rivera) |
| `cafe@eggdrop.demo` | `eggdrop-demo` | Bean There Cafe |

You can also paste `supabase/seed.sql` into the SQL editor. That loads the rows but does not create Auth users; `npm run seed` does both.

The claim, redeem, and activate operations are Postgres functions (`claim_egg`, `redeem_claim`, `activate_campaign`) so two players cannot take the same egg. Row level security is on. The Next.js server uses the service role and checks the signed-in user before it calls those functions.

## Stripe test mode

1. Use test keys (`sk_test_…`, `pk_test_…`) in `.env.local`.
2. Start the app and, in another terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

3. Put the `whsec_…` signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Hide eggs and pay with `4242 4242 4242 4242`, any future date, any CVC.

Checkout metadata carries the campaign id. `checkout.session.completed` activates the eggs. The success page also calls `/api/checkout/confirm`, which checks `payment_status === "paid"` and activates again. Activation is idempotent.

## Deploy on Vercel

Do this from a machine you control. This repo's automation does not deploy.

1. Push the branch and import the repo in Vercel. Framework preset: Next.js.
2. Add every variable from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to the deployment origin, with no trailing slash. Set `EGG_DATA_DRIVER=supabase`.
3. In Supabase → Authentication → URL configuration, add `https://<your-app>.vercel.app` as a site URL.
4. In Stripe, add a webhook endpoint `https://<your-app>.vercel.app/api/webhooks/stripe` for `checkout.session.completed`, and store its signing secret.
5. Deploy. Run `npm run seed` once from your laptop with the production Supabase keys so the demo rows and users exist.
6. Open the site on a phone, install it (Add to Home Screen / Install app), and allow camera and location when you hunt.

The local JSON database is only for development. On Vercel the filesystem is ephemeral, so production needs Supabase.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build |
| `npm run seed` | Reset local data, rewrite `supabase/seed.sql`, push to Supabase when configured |
| `npm test` | Seed counts, the 50 m gate, one-time redeem, and paid activation |
| `npm run icons` | Redraw the PWA icons |

## PWA

`public/manifest.webmanifest` and `public/sw.js` make the app installable. The service worker is registered in production only, and it never caches `/api`.
