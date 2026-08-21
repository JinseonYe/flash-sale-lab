export const INVENTORY_REPOSITORY = Symbol('INVENTORY_REPOSITORY');

export interface InventoryRepository {
  findByProductId(productId: number): Promise<{
    productId: number;
    stock: number;
  } | null>;

  decreaseIfAvailable(productId: number, quantity: number): Promise<boolean>;
}
