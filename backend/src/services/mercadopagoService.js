const { MercadoPagoConfig, Preference } = require('mercadopago');

let mpClient = null;

function getMercadoPagoClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
  }

  if (!mpClient) {
    mpClient = new MercadoPagoConfig({ accessToken });
  }
  return mpClient;
}

async function createPaymentPreference({ items, customer, total, orderId }) {
  const client = getMercadoPagoClient();

  const preference = new Preference(client);

  const preferenceData = {
    body: {
      items: [
        {
          title: `Pedido GRANJITA #${orderId.toString().slice(-6).toUpperCase()}`,
          quantity: 1,
          unit_price: total,
          currency_id: 'ARS',
        },
      ],
      payer: {
        name: customer.name,
        phone: {
          number: customer.phone,
        },
      },
      back_urls: {
        success: `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/orden/${orderId}?status=success`,
        failure: `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/orden/${orderId}?status=failure`,
        pending: `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/orden/${orderId}?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/api/webhooks/mercadopago`,
    },
  };

  const result = await preference.create(preferenceData);
  return result;
}

module.exports = {
  createPaymentPreference,
};
