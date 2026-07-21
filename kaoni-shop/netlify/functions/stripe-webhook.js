// Netlify Function: riceve le notifiche da Stripe (webhook) quando un pagamento va a buon fine
// e registra l'ordine su Supabase. Verifica la firma per essere sicuri che la richiesta
// arrivi davvero da Stripe e non da qualcun altro che finge.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async function (event) {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error('Firma webhook non valida:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

      await supabase.from('orders').insert({
        stripe_session_id: session.id,
        customer_email: session.customer_details ? session.customer_details.email : null,
        items: lineItems.data.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          amount_total: li.amount_total / 100,
        })),
        amount_total: session.amount_total / 100,
        status: 'paid',
      });
    } catch (err) {
      console.error('Errore salvataggio ordine su Supabase:', err);
      // Rispondiamo comunque 200 a Stripe per non fargli ripetere il webhook all'infinito;
      // l'errore resta nei log di Netlify per essere controllato manualmente.
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
