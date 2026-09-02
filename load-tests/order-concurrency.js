import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const createdOrders = new Counter('order_created_201');
const insufficientStock = new Counter('order_conflict_409');
const unexpectedResponses = new Counter('order_unexpected_response');

export const options = {
  scenarios: {
    concurrent_orders: {
      executor: 'per-vu-iterations',
      vus: Number(__ENV.VUS || 150),
      iterations: 1,
      maxDuration: '30s',
    },
  },
};

const baseUrl = __ENV.BASE_URL;
const userId = Number(__ENV.USER_ID);
const productId = Number(__ENV.PRODUCT_ID);

if (!baseUrl) {
  throw new Error('BASE_URL environment variable is required');
}

if (!Number.isFinite(userId)) {
  throw new Error('USER_ID environment variable is required');
}

if (!Number.isFinite(productId)) {
  throw new Error('PRODUCT_ID environment variable is required');
}

const responseCallback = http.expectedStatuses(201, 409);

export default function () {
  const payload = JSON.stringify({
    userId,
    productId,
    quantity: 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    responseCallback,
  };

  const response = http.post(`${baseUrl}/orders`, payload, params);

  if (response.status === 201) {
    createdOrders.add(1);
  } else if (response.status === 409) {
    insufficientStock.add(1);
  } else {
    unexpectedResponses.add(1);
  }

  check(response, {
    'status is 201 or 409': (res) => res.status === 201 || res.status === 409,
  });
}
