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
        findByProductId: jest.fn().mockResolvedValue({
          productId: 1,
          stock: 10,
        }),
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

      const outboxRepository = {
        create: jest.fn().mockResolvedValue(undefined),
        findPending: jest.fn(),
        claim: jest.fn(),
        recoverStuckProcessing: jest.fn(),
        markAsSent: jest.fn(),
      };

      const unitOfWork: OrderUnitOfWork = {
        execute: jest.fn(
          async <T>(
            work: (repositories: OrderTransactionRepositories) => Promise<T>,
          ): Promise<T> => {
            return work({
              inventoryRepository,
              orderRepository,
              outboxRepository,
            });
          },
        ),
      };

      const orderService = new OrderService(
        orderRepository,
        inventoryRepository,
        unitOfWork,
      );

      // Act
      const order = await orderService.create(
        {
          userId: 1,
          productId: 1,
          quantity: 2,
        },
        'test-request-id',
      );

      // Assert
      expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(1);

      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      expect(outboxRepository.create).toHaveBeenCalledWith({
        type: 'ORDER_NOTIFICATION',
        payload: {
          orderId: 1,
          requestId: 'test-request-id',
          traceContext: {},
        },
      });

      expect(inventoryRepository.decreaseIfAvailable).toHaveBeenCalledWith(
        1,
        2,
      );

      expect(order).toEqual(
        expect.objectContaining({
          userId: 1,
          productId: 1,
          quantity: 2,
        }),
      );
    });

    it('사전 조회에서 재고가 부족하면 트랜잭션에 진입하지 않고 주문이 실패해야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn().mockResolvedValue({
          productId: 1,
          stock: 1,
        }),
        decreaseIfAvailable: jest.fn(),
      };

      const orderRepository = {
        create: jest.fn(),
        findById: jest.fn(),
      };

      const outboxRepository = {
        create: jest.fn(),
        findPending: jest.fn(),
        claim: jest.fn(),
        recoverStuckProcessing: jest.fn(),
        markAsSent: jest.fn(),
      };

      const executeMock = jest.fn();

      const unitOfWork: OrderUnitOfWork = {
        execute: async <T>(
          work: (repositories: OrderTransactionRepositories) => Promise<T>,
        ): Promise<T> => {
          executeMock();

          return work({
            inventoryRepository,
            orderRepository,
            outboxRepository,
          });
        },
      };

      const orderService = new OrderService(
        orderRepository,
        inventoryRepository,
        unitOfWork,
      );

      // Act & Assert
      await expect(
        orderService.create(
          {
            userId: 1,
            productId: 1,
            quantity: 2,
          },
          'test-request-id',
        ),
      ).rejects.toThrow('재고가 부족합니다.');

      expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(1);

      expect(executeMock).not.toHaveBeenCalled();
      expect(orderRepository.create).not.toHaveBeenCalled();
      expect(outboxRepository.create).not.toHaveBeenCalled();
      expect(inventoryRepository.decreaseIfAvailable).not.toHaveBeenCalled();
    });

    it('사전 조회는 통과했지만 최종 재고 차감에 실패하면 주문이 실패해야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn().mockResolvedValue({
          productId: 1,
          stock: 2,
        }),
        decreaseIfAvailable: jest.fn().mockResolvedValue(false),
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

      const outboxRepository = {
        create: jest.fn().mockResolvedValue(undefined),
        findPending: jest.fn(),
        claim: jest.fn(),
        recoverStuckProcessing: jest.fn(),
        markAsSent: jest.fn(),
      };

      const unitOfWork: OrderUnitOfWork = {
        execute: jest.fn(
          async <T>(
            work: (repositories: OrderTransactionRepositories) => Promise<T>,
          ): Promise<T> => {
            return work({
              inventoryRepository,
              orderRepository,
              outboxRepository,
            });
          },
        ),
      };

      const orderService = new OrderService(
        orderRepository,
        inventoryRepository,
        unitOfWork,
      );

      // Act & Assert
      await expect(
        orderService.create(
          {
            userId: 1,
            productId: 1,
            quantity: 2,
          },
          'test-request-id',
        ),
      ).rejects.toThrow('재고가 부족합니다.');

      expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(1);

      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      expect(outboxRepository.create).toHaveBeenCalled();

      expect(inventoryRepository.decreaseIfAvailable).toHaveBeenCalledWith(
        1,
        2,
      );
    });

    it('재고와 주문 수량이 같으면 주문이 성공해야 한다', async () => {
      // Arrange
      const inventoryRepository = {
        findByProductId: jest.fn().mockResolvedValue({
          productId: 1,
          stock: 2,
        }),
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

      const outboxRepository = {
        create: jest.fn().mockResolvedValue(undefined),
        findPending: jest.fn(),
        claim: jest.fn(),
        recoverStuckProcessing: jest.fn(),
        markAsSent: jest.fn(),
      };

      const unitOfWork: OrderUnitOfWork = {
        execute: jest.fn(
          async <T>(
            work: (repositories: OrderTransactionRepositories) => Promise<T>,
          ): Promise<T> => {
            return work({
              inventoryRepository,
              orderRepository,
              outboxRepository,
            });
          },
        ),
      };

      const orderService = new OrderService(
        orderRepository,
        inventoryRepository,
        unitOfWork,
      );

      // Act
      const order = await orderService.create(
        {
          userId: 1,
          productId: 1,
          quantity: 2,
        },
        'test-request-id',
      );

      // Assert
      expect(inventoryRepository.findByProductId).toHaveBeenCalledWith(1);

      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: 1,
        productId: 1,
        quantity: 2,
      });

      expect(outboxRepository.create).toHaveBeenCalledWith({
        type: 'ORDER_NOTIFICATION',
        payload: {
          orderId: 1,
          requestId: 'test-request-id',
          traceContext: {},
        },
      });

      expect(inventoryRepository.decreaseIfAvailable).toHaveBeenCalledWith(
        1,
        2,
      );

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
