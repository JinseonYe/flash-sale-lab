import { OrderService } from './order.service';
import type {
  OrderTransactionRepositories,
  OrderUnitOfWork,
} from './transaction/order-unit-of-work';

describe('OrderService', () => {
  describe('create', () => {
    it('재고가 충분하면 주문이 생성되어야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn(),
        decreaseIfAvailable: jest.fn().mockResolvedValue(true),
      };

      const orderRepository = {
        create: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
        findById: jest.fn(),
      };

      const unitOfWork: OrderUnitOfWork = {
        execute: jest.fn(
          async <T>(
            work: (repositories: OrderTransactionRepositories) => Promise<T>,
          ): Promise<T> => {
            return work({
              inventoryRepository,
              orderRepository,
            });
          },
        ),
      };

      const orderService = new OrderService(orderRepository, unitOfWork);

      // Act
      const order = await orderService.create({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      // Assert
      expect(inventoryRepository.decreaseIfAvailable).toHaveBeenCalledWith(
        1,
        2,
      );

      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      expect(order).toEqual(
        expect.objectContaining({
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      );
    });

    it('재고가 부족하면 주문이 실패해야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn(),
        decreaseIfAvailable: jest.fn().mockResolvedValue(false),
      };

      const orderRepository = {
        create: jest.fn(),
        findById: jest.fn(),
      };

      const unitOfWork: OrderUnitOfWork = {
        execute: jest.fn(
          async <T>(
            work: (repositories: OrderTransactionRepositories) => Promise<T>,
          ): Promise<T> => {
            return work({
              inventoryRepository,
              orderRepository,
            });
          },
        ),
      };

      const orderService = new OrderService(orderRepository, unitOfWork);

      // Act & Assert
      await expect(
        orderService.create({
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      ).rejects.toThrow('재고가 부족합니다.');

      expect(inventoryRepository.decreaseIfAvailable).toHaveBeenCalledWith(
        1,
        2,
      );

      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it('재고와 주문 수량이 같으면 주문이 성공해야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn(),
        decreaseIfAvailable: jest.fn().mockResolvedValue(true),
      };

      const orderRepository = {
        create: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
        findById: jest.fn(),
      };

      const unitOfWork: OrderUnitOfWork = {
        execute: jest.fn(
          async <T>(
            work: (repositories: OrderTransactionRepositories) => Promise<T>,
          ): Promise<T> => {
            return work({
              inventoryRepository,
              orderRepository,
            });
          },
        ),
      };

      const orderService = new OrderService(orderRepository, unitOfWork);

      // Act
      const order = await orderService.create({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      // Assert
      expect(inventoryRepository.decreaseIfAvailable).toHaveBeenCalledWith(
        1,
        2,
      );

      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

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
