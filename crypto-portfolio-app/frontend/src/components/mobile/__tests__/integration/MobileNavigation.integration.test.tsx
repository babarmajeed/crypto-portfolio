import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { Header } from '../../layout/Header';
import MobileNavigation from '../MobileNavigation';

// Mock portal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (children: React.ReactNode) => children
}));

const MockWrapper = ({ children, initialRoute = '/' }: { 
  children: React.ReactNode;
  initialRoute?: string;
}) => (
  <MemoryRouter initialEntries={[initialRoute]}>
    {children}
  </MemoryRouter>
);

describe('Mobile Navigation Integration', () => {
  beforeEach(() => {
    // Mock window.innerWidth to simulate mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    });

    // Mock matchMedia for responsive behavior
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query.includes('(max-width: 768px)'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('integrates with Header component correctly', () => {
    render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Hamburger menu should be visible on mobile
    const hamburgerButton = screen.getByLabelText('Toggle mobile navigation');
    expect(hamburgerButton).toBeInTheDocument();

    // Click to open navigation
    fireEvent.click(hamburgerButton);

    // Navigation should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Crypto Portfolio')).toBeInTheDocument();
  });

  it('handles route navigation correctly', async () => {
    render(
      <MockWrapper initialRoute="/">
        <Header />
      </MockWrapper>
    );

    // Open navigation
    fireEvent.click(screen.getByLabelText('Toggle mobile navigation'));

    // Click on Portfolio link
    const portfolioLink = screen.getByRole('link', { name: /Portfolio/ });
    fireEvent.click(portfolioLink);

    // Navigation should close after navigation
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handles nested navigation correctly', () => {
    render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Open navigation
    fireEvent.click(screen.getByLabelText('Toggle mobile navigation'));

    // Find and click Settings (which has children)
    const settingsButton = screen.getByRole('button', { name: /Settings menu/ });
    fireEvent.click(settingsButton);

    // Should expand to show children
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
  });

  it('handles search overlay integration', () => {
    render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Click mobile search button
    const searchButton = screen.getByLabelText('Open search');
    fireEvent.click(searchButton);

    // Search overlay should open
    expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument();
    expect(screen.getByText('Trending Assets')).toBeInTheDocument();
  });

  it('handles responsive behavior', () => {
    const { rerender } = render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Mobile: hamburger should be visible
    expect(screen.getByLabelText('Toggle mobile navigation')).toBeInTheDocument();

    // Simulate desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });

    // Mock matchMedia for desktop
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: !query.includes('(max-width: 768px)'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    rerender(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Desktop: hamburger should be hidden
    expect(screen.queryByLabelText('Toggle mobile navigation')).not.toBeInTheDocument();
  });

  it('maintains accessibility during navigation', () => {
    render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Open navigation
    fireEvent.click(screen.getByLabelText('Toggle mobile navigation'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Mobile navigation menu');

    // Test keyboard navigation
    fireEvent.keyDown(document, { key: 'Escape' });
    
    // Dialog should close
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles touch gestures correctly', () => {
    render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Open navigation
    fireEvent.click(screen.getByLabelText('Toggle mobile navigation'));

    const dialog = screen.getByRole('dialog');

    // Simulate swipe left gesture
    fireEvent.touchStart(dialog, {
      touches: [{ clientX: 200, clientY: 100 }]
    });

    fireEvent.touchMove(dialog, {
      touches: [{ clientX: 50, clientY: 100 }]
    });

    fireEvent.touchEnd(dialog);

    // Navigation should close
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prevents body scroll when navigation is open', () => {
    render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Initially body scroll should be normal
    expect(document.body.style.overflow).toBe('');

    // Open navigation
    fireEvent.click(screen.getByLabelText('Toggle mobile navigation'));

    // Body scroll should be prevented
    expect(document.body.style.overflow).toBe('hidden');

    // Close navigation
    fireEvent.click(screen.getByLabelText('Close navigation menu'));

    // Body scroll should be restored
    expect(document.body.style.overflow).toBe('unset');
  });

  it('handles multiple overlay states correctly', () => {
    render(
      <MockWrapper>
        <Header />
      </MockWrapper>
    );

    // Open navigation first
    fireEvent.click(screen.getByLabelText('Toggle mobile navigation'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Try to open search (should work independently)
    fireEvent.click(screen.getByLabelText('Open search'));
    
    // Both overlays can exist (though UX might prevent this)
    expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument();
  });
});