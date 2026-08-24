import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() request: Request) {
    return this.orderService.create(dto, request.requestId);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.findById(id);
  }
}
