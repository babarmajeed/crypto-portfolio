import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import MobileNavigation from '../MobileNavigation';
import { navigation } from '../../layout/navigationConfig';

// Mock portal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (children: React.ReactNode) => children
}));

const MockWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('MobileNavigation', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders navigation when open', () => {
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} />
      </MockWrapper>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Crypto Portfolio')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} isOpen={false} />
      </MockWrapper>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders all navigation items', () => {
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} />
      </MockWrapper>
    );

    navigation.forEach(item => {
      expect(screen.getByText(item.name)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} onClose={onClose} />
      </MockWrapper>
    );

    fireEvent.click(screen.getByLabelText('Close navigation menu'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} onClose={onClose} />
      </MockWrapper>
    );

    const backdrop = document.querySelector('.fixed.inset-0.bg-black');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard navigation (Escape key)', () => {
    const onClose = jest.fn();
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} onClose={onClose} />
      </MockWrapper>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('expands and collapses nested navigation items', () => {
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} />
      </MockWrapper>
    );

    // Find a navigation item with children (Portfolio has children)
    const portfolioButton = screen.getByRole('button', { name: /Portfolio menu/ });
    
    // Initially collapsed
    expect(portfolioButton).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    fireEvent.click(portfolioButton);
    expect(portfolioButton).toHaveAttribute('aria-expanded', 'true');

    // Check if child items are visible
    expect(screen.getByText('Holdings')).toBeInTheDocument();
  });

  it('handles touch gestures for swipe-to-close', () => {
    const onClose = jest.fn();
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} onClose={onClose} />
      </MockWrapper>
    );

    const drawer = screen.getByRole('dialog');

    // Simulate swipe left gesture
    fireEvent.touchStart(drawer, {
      touches: [{ clientX: 200, clientY: 100 }]
    });

    fireEvent.touchMove(drawer, {
      touches: [{ clientX: 50, clientY: 100 }]
    });

    fireEvent.touchEnd(drawer);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prevents body scroll when open', () => {
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} />
      </MockWrapper>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when closed', () => {
    const { rerender } = render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} />
      </MockWrapper>
    );

    rerender(
      <MockWrapper>
        <MobileNavigation {...defaultProps} isOpen={false} />
      </MockWrapper>
    );

    expect(document.body.style.overflow).toBe('unset');
  });

  it('shows swipe indicator during drag', () => {
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} />
      </MockWrapper>
    );

    const drawer = screen.getByRole('dialog');

    fireEvent.touchStart(drawer, {
      touches: [{ clientX: 200, clientY: 100 }]
    });

    fireEvent.touchMove(drawer, {
      touches: [{ clientX: 150, clientY: 100 }]
    });

    // Check if swipe indicator is visible
    const swipeIndicator = document.querySelector('.absolute.top-1\\/2.left-0');
    expect(swipeIndicator).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <MockWrapper>
        <MobileNavigation {...defaultProps} />
      </MockWrapper>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Mobile navigation menu');

    const navigation = screen.getByRole('navigation');
    expect(navigation).toBeInTheDocument();
  });
});