export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface CreateOrderInput {
  userId: number;
  productId: number;
  quantity: number;
}

export interface Order {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
}

export interface OrderRepository {
  create(input: CreateOrderInput): Promise<Order>;

  findById(id: number): Promise<Order | null>;
}
