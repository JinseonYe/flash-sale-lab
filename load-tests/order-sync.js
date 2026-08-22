import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '10s',
};

export default function () {
  const payload = JSON.stringify({
    userId: 33,
    productId: 65,
    quantity: 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post('http://localhost:3000/orders', payload, params);

  check(response, {
    'status is 201': (res) => res.status === 201,
  });
}
