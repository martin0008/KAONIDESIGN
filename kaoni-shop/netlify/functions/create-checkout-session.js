// Netlify Function: crea una sessione di pagamento Stripe Checkout.
// Riceve dal browser solo gli ID prodotto e le quantità (MAI i prezzi):
// i prezzi vengono sempre recuperati da Supabase qui sul server, così
// nessuno può manipolare gli importi modificando il codice nel browser.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role: usata SOLO qui lato server, mai nel browser
);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Corpo della richiesta non valido.' }) };
  }

  const cartItems = Array.isArray(body.items) ? body.items : [];
  if (cartItems.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Il carrello è vuoto.' }) };
  }

  // Limite di sicurezza di base
  if (cartItems.length > 50) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Troppi articoli nel carrello.' }) };
  }

  const productIds = cartItems.map((i) => String(i.id));

  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, price, image_url')
    .in('id', productIds);

  if (error) {
    console.error('Errore Supabase:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore nel recupero dei prodotti.' }) };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  const line_items = [];
  for (const item of cartItems) {
    const product = productMap.get(String(item.id));
    if (!product) continue;

    const quantity = Math.max(1, Math.min(99, parseInt(item.quantity, 10) || 1));

    line_items.push({
      quantity,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(Number(product.price) * 100), // prezzo in centesimi, preso dal DB
        product_data: {
          name: product.title,
          images: product.image_url ? [product.image_url] : [],
        },
      },
    });
  }

  if (line_items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Nessun prodotto valido trovato.' }) };
  }

  const siteUrl = process.env.URL || process.env.SITE_URL || 'http://localhost:8888';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel.html`,
      shipping_address_collection: { allowed_countries: ['IT', 'CH', 'SM', 'VA'] },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Errore Stripe:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore nella creazione del pagamento.' }) };
  }
};
