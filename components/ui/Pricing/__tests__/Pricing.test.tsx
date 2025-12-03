/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Pricing from '../Pricing';
import { useRouter, usePathname } from 'next/navigation';
import { checkoutWithStripe } from '@/utils/stripe/server';
import { getStripe } from '@/utils/stripe/client';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/utils/stripe/server');
jest.mock('@/utils/stripe/client');

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockCheckoutWithStripe = checkoutWithStripe as jest.MockedFunction<typeof checkoutWithStripe>;
const mockGetStripe = getStripe as jest.MockedFunction<typeof getStripe>;

describe('Pricing Component', () => {
  const mockProducts = [
    {
      id: 'prod_1',
      active: true,
      name: 'Basic Plan',
      description: 'Basic subscription plan',
      image: null,
      metadata: {},
      prices: [
        {
          id: 'price_1',
          product_id: 'prod_1',
          active: true,
          description: null,
          unit_amount: 999,
          currency: 'usd',
          type: 'recurring',
          interval: 'month' as const,
          interval_count: 1,
          trial_period_days: null,
          metadata: {},
        },
      ],
    },
    {
      id: 'prod_2',
      active: true,
      name: 'Pro Plan',
      description: 'Professional subscription plan',
      image: null,
      metadata: {},
      prices: [
        {
          id: 'price_2',
          product_id: 'prod_2',
          active: true,
          description: null,
          unit_amount: 1999,
          currency: 'usd',
          type: 'recurring',
          interval: 'month' as const,
          interval_count: 1,
          trial_period_days: null,
          metadata: {},
        },
      ],
    },
  ];

  const mockUser = {
    id: 'user_1',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2023-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    } as any);
    mockUsePathname.mockReturnValue('/pricing');
  });

  describe('Rendering', () => {
    it('should render pricing component with products', () => {
      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      expect(screen.getByText('Basic Plan')).toBeInTheDocument();
      expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    });

    it('should render empty state when no products available', () => {
      render(<Pricing user={mockUser} products={[]} subscription={null} />);

      expect(screen.getByText(/No subscription pricing plans found/i)).toBeInTheDocument();
      expect(screen.getByText(/Stripe Dashboard/i)).toBeInTheDocument();
    });

    it('should render price in correct format', () => {
      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      // $9.99/month
      expect(screen.getByText(/9\.99/)).toBeInTheDocument();
      expect(screen.getByText(/19\.99/)).toBeInTheDocument();
    });

    it('should render subscription button when no active subscription', () => {
      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      const subscribeButtons = screen.getAllByText(/Subscribe/i);
      expect(subscribeButtons.length).toBeGreaterThan(0);
    });

    it('should show manage subscription when user has active subscription', () => {
      const mockSubscription = {
        id: 'sub_1',
        user_id: 'user_1',
        status: 'active' as const,
        metadata: {},
        price_id: 'price_1',
        quantity: 1,
        cancel_at_period_end: false,
        created: '2023-01-01',
        current_period_start: '2023-01-01',
        current_period_end: '2023-02-01',
        ended_at: null,
        cancel_at: null,
        canceled_at: null,
        trial_start: null,
        trial_end: null,
        prices: {
          id: 'price_1',
          product_id: 'prod_1',
          active: true,
          description: null,
          unit_amount: 999,
          currency: 'usd',
          type: 'recurring',
          interval: 'month' as const,
          interval_count: 1,
          trial_period_days: null,
          metadata: {},
          products: mockProducts[0],
        },
      };

      render(<Pricing user={mockUser} products={mockProducts} subscription={mockSubscription} />);

      expect(screen.getByText(/Manage/i)).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should redirect to signup when user is not logged in', async () => {
      render(<Pricing user={null} products={mockProducts} subscription={null} />);

      const subscribeButtons = screen.getAllByText(/Subscribe/i);
      fireEvent.click(subscribeButtons[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin/signup');
      });
    });

    it('should initiate checkout when logged in user clicks subscribe', async () => {
      mockCheckoutWithStripe.mockResolvedValue({
        errorRedirect: null,
        sessionId: 'session_123',
      });

      const mockRedirectToCheckout = jest.fn();
      mockGetStripe.mockResolvedValue({
        redirectToCheckout: mockRedirectToCheckout,
      } as any);

      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      const subscribeButtons = screen.getAllByText(/Subscribe/i);
      fireEvent.click(subscribeButtons[0]);

      await waitFor(() => {
        expect(mockCheckoutWithStripe).toHaveBeenCalledWith(
          mockProducts[0].prices[0],
          '/pricing'
        );
      });

      await waitFor(() => {
        expect(mockRedirectToCheckout).toHaveBeenCalledWith({ sessionId: 'session_123' });
      });
    });

    it('should handle checkout error gracefully', async () => {
      mockCheckoutWithStripe.mockResolvedValue({
        errorRedirect: '/error?message=Checkout%20failed',
        sessionId: null,
      });

      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      const subscribeButtons = screen.getAllByText(/Subscribe/i);
      fireEvent.click(subscribeButtons[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/error?message=Checkout%20failed');
      });
    });

    it('should show loading state during checkout', async () => {
      mockCheckoutWithStripe.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      const subscribeButtons = screen.getAllByText(/Subscribe/i);
      fireEvent.click(subscribeButtons[0]);

      // Button should be disabled during loading
      await waitFor(() => {
        expect(subscribeButtons[0]).toBeDisabled();
      });
    });

    it('should handle session creation failure', async () => {
      mockCheckoutWithStripe.mockResolvedValue({
        errorRedirect: null,
        sessionId: null,
      });

      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      const subscribeButtons = screen.getAllByText(/Subscribe/i);
      fireEvent.click(subscribeButtons[0]);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/error'));
      });
    });
  });

  describe('Billing Intervals', () => {
    const productsWithMultipleIntervals = [
      {
        id: 'prod_1',
        active: true,
        name: 'Flexible Plan',
        description: 'Plan with multiple billing options',
        image: null,
        metadata: {},
        prices: [
          {
            id: 'price_monthly',
            product_id: 'prod_1',
            active: true,
            description: null,
            unit_amount: 999,
            currency: 'usd',
            type: 'recurring',
            interval: 'month' as const,
            interval_count: 1,
            trial_period_days: null,
            metadata: {},
          },
          {
            id: 'price_yearly',
            product_id: 'prod_1',
            active: true,
            description: null,
            unit_amount: 9999,
            currency: 'usd',
            type: 'recurring',
            interval: 'year' as const,
            interval_count: 1,
            trial_period_days: null,
            metadata: {},
          },
        ],
      },
    ];

    it('should display billing interval selector when multiple intervals exist', () => {
      render(<Pricing user={mockUser} products={productsWithMultipleIntervals} subscription={null} />);

      // Should have interval selection buttons
      const monthlyButton = screen.getByText(/month/i);
      const yearlyButton = screen.getByText(/year/i);

      expect(monthlyButton).toBeInTheDocument();
      expect(yearlyButton).toBeInTheDocument();
    });

    it('should switch between billing intervals', () => {
      render(<Pricing user={mockUser} products={productsWithMultipleIntervals} subscription={null} />);

      const yearlyButton = screen.getByText(/year/i);
      fireEvent.click(yearlyButton);

      // Should show yearly price
      expect(screen.getByText(/99\.99/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible product names as headings', () => {
      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      const basicPlanHeading = screen.getByRole('heading', { name: /Basic Plan/i });
      const proPlanHeading = screen.getByRole('heading', { name: /Pro Plan/i });

      expect(basicPlanHeading).toBeInTheDocument();
      expect(proPlanHeading).toBeInTheDocument();
    });

    it('should have accessible buttons with descriptive text', () => {
      render(<Pricing user={mockUser} products={mockProducts} subscription={null} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // All buttons should have accessible names
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle products with no prices', () => {
      const productsNoPrices = [{
        id: 'prod_no_price',
        active: true,
        name: 'No Price Product',
        description: 'Product without pricing',
        image: null,
        metadata: {},
        prices: [],
      }];

      render(<Pricing user={mockUser} products={productsNoPrices} subscription={null} />);

      expect(screen.getByText('No Price Product')).toBeInTheDocument();
    });

    it('should handle products with custom metadata', () => {
      const productsWithMetadata = [{
        ...mockProducts[0],
        metadata: { featured: 'true', badge: 'Popular' },
      }];

      render(<Pricing user={mockUser} products={productsWithMetadata} subscription={null} />);

      expect(screen.getByText('Basic Plan')).toBeInTheDocument();
    });

    it('should handle undefined subscription gracefully', () => {
      render(<Pricing user={mockUser} products={mockProducts} subscription={undefined as any} />);

      expect(screen.getByText('Basic Plan')).toBeInTheDocument();
    });

    it('should handle products with null descriptions', () => {
      const productsNoDesc = [{
        ...mockProducts[0],
        description: null,
      }];

      render(<Pricing user={mockUser} products={productsNoDesc} subscription={null} />);

      expect(screen.getByText('Basic Plan')).toBeInTheDocument();
    });
  });

  describe('Price Formatting', () => {
    it('should format different currencies correctly', () => {
      const eurProducts = [{
        ...mockProducts[0],
        prices: [{
          ...mockProducts[0].prices[0],
          currency: 'eur',
          unit_amount: 1099,
        }],
      }];

      render(<Pricing user={mockUser} products={eurProducts} subscription={null} />);

      // Should display EUR pricing
      expect(screen.getByText(/10\.99/)).toBeInTheDocument();
    });

    it('should handle zero-price products', () => {
      const freeProducts = [{
        ...mockProducts[0],
        name: 'Free Plan',
        prices: [{
          ...mockProducts[0].prices[0],
          unit_amount: 0,
        }],
      }];

      render(<Pricing user={mockUser} products={freeProducts} subscription={null} />);

      expect(screen.getByText('Free Plan')).toBeInTheDocument();
    });
  });
});
