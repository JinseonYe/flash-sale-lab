import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 300,
  duration: '30s',
};

export default function () {
  const response = http.get('http://localhost:3000/products/65');

  check(response, {
    'status is 200': (res) => res.status === 200,
  });
}
