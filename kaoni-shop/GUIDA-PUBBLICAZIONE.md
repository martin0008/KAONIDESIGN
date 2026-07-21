# Kaoni Design — Guida alla pubblicazione

Questo pacchetto contiene un sito e-commerce completo:
- `public/index.html` — il sito (home, collezione, pannello admin, carrello)
- `public/success.html`, `public/cancel.html` — pagine dopo il pagamento
- `netlify/functions/` — il "backend" che crea il pagamento Stripe in modo sicuro
- `supabase-schema.sql` — le tabelle del database da creare su Supabase

Segui questi passaggi **in ordine**. Non serve installare nulla sul tuo computer: si fa tutto dai siti web di Supabase, Stripe e Netlify.

---

## 1. Crea il database su Supabase

1. Vai su [supabase.com](https://supabase.com) → crea un account gratuito → crea un nuovo progetto.
2. Scegli una password per il database (salvala da qualche parte) e una regione vicina a te (es. Frankfurt).
3. Una volta creato il progetto, vai su **SQL Editor** (menu a sinistra) → **New query**.
4. Apri il file `supabase-schema.sql` incluso in questo pacchetto, copia tutto il contenuto, incollalo nell'editor e premi **Run**.
5. Vai su **Project Settings → API**. Ti servono due valori, tienili a portata di mano:
   - **Project URL** (es. `https://xxxxx.supabase.co`)
   - **anon public key** (una stringa lunga che inizia con `eyJ...`)
   - **service_role key** (un'altra stringa `eyJ...`, questa è SEGRETA — non va mai nel codice del sito)

---

## 2. Inserisci le chiavi Supabase nel sito

Apri `public/index.html`, cerca queste due righe (vicino all'inizio dello script, cerca "CONFIGURAZIONE SUPABASE"):

```js
const SUPABASE_URL = 'INSERISCI_QUI_LA_TUA_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'INSERISCI_QUI_LA_TUA_SUPABASE_ANON_KEY';
```

Sostituisci con i tuoi valori reali (Project URL e **anon public key**, non la service_role). Questa chiave è pensata per stare nel codice pubblico del sito, è sicura da esporre — la sicurezza vera è gestita dalle regole RLS che abbiamo già creato nel passaggio 1.

---

## 3. Crea l'account Stripe

1. Vai su [stripe.com](https://stripe.com) → crea un account.
2. Resta pure in **modalità test** per ora (si vede in alto a sinistra nella dashboard) — puoi fare pagamenti finti con carte di prova prima di passare ai soldi veri.
3. Vai su **Developers → API keys**. Ti servono:
   - **Publishable key** (`pk_test_...`)
   - **Secret key** (`sk_test_...`) — SEGRETA, mai nel codice del sito

Quando sarai pronto per accettare pagamenti veri, dovrai completare l'attivazione dell'account (dati aziendali/personali e IBAN) dalla stessa dashboard, poi passare alle chiavi `pk_live_` / `sk_live_`.

---

## 4. Pubblica il sito su Netlify

1. Vai su [netlify.com](https://netlify.com) → crea un account gratuito.
2. Il modo più semplice: carica l'intera cartella di questo progetto su GitHub (crea un repository nuovo, carica tutti i file mantenendo la struttura di cartelle), poi su Netlify scegli **Add new site → Import an existing project** e collega quel repository.
   - In alternativa, se non vuoi usare GitHub: su Netlify puoi anche trascinare la cartella direttamente in **Sites → Add new site → Deploy manually** — ma in quel caso ogni modifica futura andrà ricaricata a mano.
3. Netlify rileverà automaticamente `netlify.toml` e configurerà da solo la cartella `public` e le funzioni.

### Imposta le variabili segrete su Netlify

Vai su **Site settings → Environment variables** e aggiungi:

| Nome variabile | Valore |
|---|---|
| `STRIPE_SECRET_KEY` | la tua secret key Stripe (`sk_test_...`) |
| `SUPABASE_URL` | la stessa Project URL di prima |
| `SUPABASE_SERVICE_ROLE_KEY` | la service_role key di Supabase (quella segreta) |
| `STRIPE_WEBHOOK_SECRET` | la aggiungi al passaggio 5 |

Dopo aver aggiunto le variabili, fai un **redeploy** del sito (Netlify → Deploys → Trigger deploy).

---

## 5. Collega il webhook Stripe (per registrare gli ordini)

1. Il tuo sito ora ha un indirizzo tipo `https://kaoni-design.netlify.app`.
2. Su Stripe → **Developers → Webhooks → Add endpoint**.
3. Come URL metti: `https://IL-TUO-SITO.netlify.app/.netlify/functions/stripe-webhook`
4. Come evento da ascoltare seleziona `checkout.session.completed`.
5. Dopo averlo creato, Stripe ti mostra un **Signing secret** (`whsec_...`) — copialo e aggiungilo come variabile `STRIPE_WEBHOOK_SECRET` su Netlify (passaggio 4), poi fai di nuovo un redeploy.

---

## 6. Prova tutto

1. Apri il tuo sito online, entra nel pannello admin (triplo click sul logo → `KaoniStaff2026` / `KaoniEleganceinMotion`) e aggiungi un prodotto vero.
2. Torna alla home, aggiungi il prodotto al carrello, clicca "Vai al pagamento".
3. Userai una **carta di prova Stripe** finché sei in modalità test, ad esempio:
   - Numero: `4242 4242 4242 4242`
   - Data: qualsiasi data futura — CVC: qualsiasi 3 cifre
4. Se tutto va bene, finirai sulla pagina di conferma, e vedrai l'ordine registrato nella tabella `orders` su Supabase.

---

## Quando sei pronto per i soldi veri

1. Completa l'attivazione del tuo account Stripe (dati e IBAN).
2. Sostituisci `STRIPE_SECRET_KEY` su Netlify con la versione `sk_live_...`.
3. Aggiorna anche il webhook Stripe in modalità live (se lo avevi creato solo in test) e il relativo `STRIPE_WEBHOOK_SECRET`.

Da quel momento i pagamenti veri arriveranno sul tuo account Stripe, che li trasferirà (payout) sull'IBAN collegato secondo i tempi standard di Stripe (di solito qualche giorno).

---

## Nota sulla sicurezza del pannello admin

Il login `KaoniStaff2026` / `KaoniEleganceinMotion` è solo un controllo visivo nel browser: protegge dai click casuali, ma chiunque sappia usare gli strumenti sviluppatore del browser potrebbe in teoria leggere/scrivere dati su Supabase direttamente, aggirandolo. Va bene per iniziare, ma se il negozio cresce e gestisci ordini reali, conviene passare a un vero sistema di login (Supabase Auth) prima di renderlo pubblico su larga scala.
