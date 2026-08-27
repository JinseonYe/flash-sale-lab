import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '30s',
};

const baseUrl = __ENV.BASE_URL;

export default function () {
  const response = http.get(`${baseUrl}/`);

  check(response, {
    'status is 200': (res) => res.status === 200,
  });
}
