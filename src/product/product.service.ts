import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from './repository/product.repository';
import type { ProductRepository } from './repository/product.repository';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async findById(id: number) {
    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return product;
  }

  async findStockById(id: number) {
    const inventory = await this.productRepository.findStockById(id);

    if (!inventory) {
      throw new NotFoundException('재고 정보를 찾을 수 없습니다.');
    }

    return inventory;
  }
}
