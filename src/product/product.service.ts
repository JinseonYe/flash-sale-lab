import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from './repository/product.repository';
import type { ProductRepository } from './repository/product.repository';
import { RedisService } from '../redis/redis.service';

type Product = NonNullable<Awaited<ReturnType<ProductRepository['findById']>>>;

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
    private readonly redisService: RedisService,
  ) {}

  async findById(id: number): Promise<Product> {
    const cachedProduct = await this.redisService.get(`product:${id}`);

    if (cachedProduct) {
      return JSON.parse(cachedProduct) as Product;
    }

    const product = await this.productRepository.findById(id);

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    await this.redisService.set(`product:${id}`, JSON.stringify(product), 60);

    return product;
  }

  async findStockById(id: number) {
    const inventory = await this.productRepository.findStockById(id);

    if (!inventory) {
      throw new NotFoundException('재고 정보를 찾을 수 없습니다.');
    }

    return inventory;
  }

  async updatePrice(id: number, price: number) {
    const product = await this.productRepository.updatePrice(id, price);

    await this.redisService.del(`product:${id}`);

    return product;
  }
}
