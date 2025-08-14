import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import TouchNavigation from '../TouchNavigation';
import { BarChart3, Briefcase, History } from 'lucide-react';

const MockWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const mockItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3,
    description: 'View your portfolio overview'
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: Briefcase,
    badge: '5',
    description: 'Manage your assets'
  },
  {
    name: 'History',
    href: '/history',
    icon: History
  }
];

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: jest.fn(),
  writable: true
});

describe('TouchNavigation', () => {
  const defaultProps = {
    items: mockItems
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all navigation items', () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    mockItems.forEach(item => {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    });
  });

  it('renders item descriptions when provided', () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    expect(screen.getByText('View your portfolio overview')).toBeInTheDocument();
    expect(screen.getByText('Manage your assets')).toBeInTheDocument();
  });

  it('renders badges when provided', () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('handles touch interactions', () => {
    const onItemClick = jest.fn();
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} onItemClick={onItemClick} />
      </MockWrapper>
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });

    // Simulate touch start
    fireEvent.touchStart(dashboardLink, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    // Check if pressed state is applied
    expect(dashboardLink).toHaveClass('scale-95');

    // Simulate touch end
    fireEvent.touchEnd(dashboardLink);
  });

  it('creates ripple effects on touch', async () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });

    fireEvent.touchStart(dashboardLink, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    // Check if ripple element is created
    await waitFor(() => {
      const ripple = document.querySelector('.animate-ping');
      expect(ripple).toBeInTheDocument();
    });
  });

  it('triggers haptic feedback on supported devices', () => {
    const vibrateSpy = jest.spyOn(navigator, 'vibrate');
    
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });

    fireEvent.touchStart(dashboardLink, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it('calls onItemClick when item is clicked', () => {
    const onItemClick = jest.fn();
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} onItemClick={onItemClick} />
      </MockWrapper>
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
    fireEvent.click(dashboardLink);

    expect(onItemClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('applies active styles correctly', () => {
    // Mock current location to match one of the items
    const mockLocation = { pathname: '/dashboard' };
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useLocation: () => mockLocation
    }));

    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    const activeLink = screen.getByRole('link', { name: /Dashboard/ });
    expect(activeLink).toHaveClass('bg-primary-100');
  });

  it('prevents default touch behavior', () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
    
    // Check WebKit touch styles
    expect(dashboardLink).toHaveStyle({
      WebkitTapHighlightColor: 'transparent',
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none'
    });
  });

  it('handles touch cancel events', () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });

    fireEvent.touchStart(dashboardLink, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    expect(dashboardLink).toHaveClass('scale-95');

    fireEvent.touchCancel(dashboardLink);

    // Should remove pressed state
    expect(dashboardLink).not.toHaveClass('scale-95');
  });

  it('renders touch target indicators', () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    // Check for touch target indicators (small circles)
    const indicators = document.querySelectorAll('.w-2.h-2.bg-gray-300');
    expect(indicators).toHaveLength(mockItems.length);
  });

  it('provides accessibility announcements', () => {
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} />
      </MockWrapper>
    );

    const announceElement = screen.getByLabelText('polite');
    expect(announceElement).toHaveAttribute('aria-live', 'polite');
    expect(announceElement).toHaveAttribute('aria-atomic', 'true');
  });

  it('applies custom className', () => {
    const customClass = 'custom-touch-nav';
    render(
      <MockWrapper>
        <TouchNavigation {...defaultProps} className={customClass} />
      </MockWrapper>
    );

    const container = document.querySelector('.touch-navigation');
    expect(container).toHaveClass(customClass);
  });
});