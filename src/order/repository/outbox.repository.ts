export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface CreateOutboxEventInput {
  type: string;
  payload: {
    orderId: number;
    requestId: string;
    traceContext: Record<string, string>;
  };
}

export interface PendingOutboxEvent {
  id: number;
  type: string;
  payload: {
    orderId: number;
    requestId: string;
    traceContext: Record<string, string>;
  };
}

export interface OutboxRepository {
  create(input: CreateOutboxEventInput): Promise<void>;
  findPending(limit: number): Promise<PendingOutboxEvent[]>;
  claim(id: number): Promise<boolean>;
  recoverStuckProcessing(): Promise<number>;
  markAsSent(id: number): Promise<void>;
}
