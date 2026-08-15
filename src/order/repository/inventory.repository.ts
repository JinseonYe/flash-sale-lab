export interface InventoryRepository {
  findByProductId(productId: number): Promise<{
    productId: number;
    stock: number;
  }>;

  decrease(productId: number, quantity: number): Promise<void>;
}
