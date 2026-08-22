import { IsInt, Min } from 'class-validator';

export class UpdateProductPriceDto {
  @IsInt()
  @Min(0)
  price: number;
}
