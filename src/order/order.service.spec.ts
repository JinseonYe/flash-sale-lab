import { OrderService } from './order.service';

describe('OrderService', () => {
  describe('create', () => {
    it('재고가 충분하면 주문이 생성되어야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn().mockResolvedValue({
          productId: 1,
          stock: 10,
        }),
        decrease: jest.fn(),
      };

      const orderRepository = {
        create: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      };

      const orderService = new OrderService(
        inventoryRepository,
        orderRepository,
      );

      // Act
      const order = await orderService.create({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      // Assert
      expect(order).toEqual(
        expect.objectContaining({
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      );

      expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(1);
    });

    it('재고가 부족하면 주문이 실패해야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn().mockResolvedValue({
          productId: 1,
          stock: 1,
        }),
        decrease: jest.fn(),
      };

      const orderRepository = {
        create: jest.fn(),
      };

      const orderService = new OrderService(
        inventoryRepository,
        orderRepository,
      );

      // Act & Assert
      await expect(
        orderService.create({
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      ).rejects.toThrow('재고가 부족합니다.');

      expect(inventoryRepository.decrease).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('재고와 주문 수량이 같으면 주문이 성공해야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn().mockResolvedValue({
          productId: 1,
          stock: 2,
        }),
        decrease: jest.fn().mockResolvedValue(undefined),
      };

      const orderRepository = {
        create: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      };

      const orderService = new OrderService(
        inventoryRepository,
        orderRepository,
      );

      // Act
      const order = await orderService.create({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      // Assert
      expect(inventoryRepository.decrease).toHaveBeenCalledWith(1, 2);
      expect(orderRepository.create).toHaveBeenCalled();
      expect(order).toEqual(
        expect.objectContaining({
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      );
    });
  });
});
