#!/usr/bin/env bash

set -euo pipefail

: "${IMAGE_TAG:?IMAGE_TAG is required}"

export DATABASE_URL="$(aws ssm get-parameter \
  --name "/flash-sale/prod/DATABASE_URL" \
  --with-decryption \
  --region ap-northeast-2 \
  --query "Parameter.Value" \
  --output text)"

export REDIS_URL="$(aws ssm get-parameter \
  --name "/flash-sale/prod/REDIS_URL" \
  --region ap-northeast-2 \
  --query "Parameter.Value" \
  --output text)"

export RABBITMQ_URL="$(aws ssm get-parameter \
  --name "/flash-sale/prod/RABBITMQ_URL" \
  --with-decryption \
  --region ap-northeast-2 \
  --query "Parameter.Value" \
  --output text)"

echo "Logging in to Amazon ECR..."

aws ecr get-login-password \
  --region ap-northeast-2 \
  | docker login \
      --username AWS \
      --password-stdin 704887592908.dkr.ecr.ap-northeast-2.amazonaws.com

docker compose -f compose.aws.api.yaml pull

docker compose -f compose.aws.api.yaml up -d

echo "Waiting for API health check..."

for i in {1..20}; do
  if curl -fsS http://localhost:3000/health > /dev/null; then
    echo "Deployment succeeded: API is healthy."

    docker image prune -a -f

    exit 0
  fi

  sleep 2
done

echo "Deployment failed: API health check did not pass." >&2
exit 1