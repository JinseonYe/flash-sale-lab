import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: '10s',
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
const userId = Number(__ENV.USER_ID);
const productId = Number(__ENV.PRODUCT_ID);
const expectedStatus = Number(__ENV.EXPECTED_STATUS || 201);

if (!Number.isFinite(userId)) {
  throw new Error('USER_ID environment variable is required');
}

if (!Number.isFinite(productId)) {
  throw new Error('PRODUCT_ID environment variable is required');
}

const responseCallback = http.expectedStatuses(expectedStatus);

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

  check(response, {
    'status is expected': (res) => res.status === expectedStatus,
  });
}
