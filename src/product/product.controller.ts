import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findById(id);
  }

  @Get(':id/stock')
  findStockById(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findStockById(id);
  }

  @Patch(':id/price')
  updatePrice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductPriceDto,
  ) {
    return this.productService.updatePrice(id, dto.price);
  }
}
