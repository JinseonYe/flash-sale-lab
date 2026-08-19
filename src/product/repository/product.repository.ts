export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductRepository {
  findById(id: number): Promise<{
    id: number;
    name: string;
    price: number;
  } | null>;

  findStockById(id: number): Promise<{
    productId: number;
    stock: number;
  } | null>;
}
