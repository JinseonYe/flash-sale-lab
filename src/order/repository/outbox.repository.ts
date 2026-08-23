export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface CreateOutboxEventInput {
  type: string;
  payload: {
    orderId: number;
  };
}

export interface PendingOutboxEvent {
  id: number;
  type: string;
  payload: {
    orderId: number;
  };
}

export interface OutboxRepository {
  create(input: CreateOutboxEventInput): Promise<void>;
  findPending(): Promise<PendingOutboxEvent[]>;
  markAsSent(id: number): Promise<void>;
}
