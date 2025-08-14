import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavigationDrawer from '../NavigationDrawer';

// Mock portal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (children: React.ReactNode) => children
}));

describe('NavigationDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <div>Drawer Content</div>
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders content when open', () => {
    render(<NavigationDrawer {...defaultProps} />);
    
    expect(screen.getByText('Drawer Content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<NavigationDrawer {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Drawer Content')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies custom width', () => {
    const customWidth = '400px';
    render(<NavigationDrawer {...defaultProps} width={customWidth} />);
    
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveStyle({ width: customWidth });
  });

  it('positions drawer on left by default', () => {
    render(<NavigationDrawer {...defaultProps} />);
    
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveStyle({ left: '0' });
  });

  it('positions drawer on right when specified', () => {
    render(<NavigationDrawer {...defaultProps} position="right" />);
    
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveStyle({ right: '0' });
  });

  it('renders backdrop by default', () => {
    render(<NavigationDrawer {...defaultProps} />);
    
    const backdrop = document.querySelector('.fixed.inset-0.bg-black');
    expect(backdrop).toBeInTheDocument();
  });

  it('hides backdrop when disabled', () => {
    render(<NavigationDrawer {...defaultProps} backdrop={false} />);
    
    const backdrop = document.querySelector('.fixed.inset-0.bg-black');
    expect(backdrop).not.toBeInTheDocument();
  });

  it('closes on backdrop click', () => {
    const onClose = jest.fn();
    render(<NavigationDrawer {...defaultProps} onClose={onClose} />);
    
    const backdrop = document.querySelector('.fixed.inset-0.bg-black');
    fireEvent.click(backdrop!);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    const onClose = jest.fn();
    render(<NavigationDrawer {...defaultProps} onClose={onClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles touch swipe to close (left drawer)', () => {
    const onClose = jest.fn();
    render(<NavigationDrawer {...defaultProps} onClose={onClose} position="left" />);
    
    const drawer = screen.getByRole('dialog');
    
    // Simulate swipe left
    fireEvent.touchStart(drawer, {
      touches: [{ clientX: 200, clientY: 100 }]
    });
    
    fireEvent.touchMove(drawer, {
      touches: [{ clientX: 50, clientY: 100 }]
    });
    
    fireEvent.touchEnd(drawer);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles touch swipe to close (right drawer)', () => {
    const onClose = jest.fn();
    render(<NavigationDrawer {...defaultProps} onClose={onClose} position="right" />);
    
    const drawer = screen.getByRole('dialog');
    
    // Simulate swipe right
    fireEvent.touchStart(drawer, {
      touches: [{ clientX: 50, clientY: 100 }]
    });
    
    fireEvent.touchMove(drawer, {
      touches: [{ clientX: 200, clientY: 100 }]
    });
    
    fireEvent.touchEnd(drawer);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores insufficient swipe distance', () => {
    const onClose = jest.fn();
    render(<NavigationDrawer {...defaultProps} onClose={onClose} />);
    
    const drawer = screen.getByRole('dialog');
    
    // Simulate small swipe (below threshold)
    fireEvent.touchStart(drawer, {
      touches: [{ clientX: 100, clientY: 100 }]
    });
    
    fireEvent.touchMove(drawer, {
      touches: [{ clientX: 80, clientY: 100 }]
    });
    
    fireEvent.touchEnd(drawer);
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables swipe to close when specified', () => {
    const onClose = jest.fn();
    render(<NavigationDrawer {...defaultProps} onClose={onClose} swipeToClose={false} />);
    
    const drawer = screen.getByRole('dialog');
    
    // Simulate swipe
    fireEvent.touchStart(drawer, {
      touches: [{ clientX: 200, clientY: 100 }]
    });
    
    fireEvent.touchMove(drawer, {
      touches: [{ clientX: 50, clientY: 100 }]
    });
    
    fireEvent.touchEnd(drawer);
    
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles mouse drag on desktop', () => {
    const onClose = jest.fn();
    render(<NavigationDrawer {...defaultProps} onClose={onClose} />);
    
    const drawer = screen.getByRole('dialog');
    
    // Simulate mouse drag
    fireEvent.mouseDown(drawer, { clientX: 200 });
    
    // Simulate mouse move (need to trigger on document)
    const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 50 });
    document.dispatchEvent(mouseMoveEvent);
    
    const mouseUpEvent = new MouseEvent('mouseup', { clientX: 50 });
    document.dispatchEvent(mouseUpEvent);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows drag indicator when swipeToClose is enabled', () => {
    render(<NavigationDrawer {...defaultProps} swipeToClose={true} />);
    
    const dragIndicator = document.querySelector('.w-8.h-1.bg-gray-300');
    expect(dragIndicator).toBeInTheDocument();
  });

  it('hides drag indicator when swipeToClose is disabled', () => {
    render(<NavigationDrawer {...defaultProps} swipeToClose={false} />);
    
    const dragIndicator = document.querySelector('.w-8.h-1.bg-gray-300');
    expect(dragIndicator).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-drawer';
    render(<NavigationDrawer {...defaultProps} className={customClass} />);
    
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveClass(customClass);
  });

  it('manages focus properly', () => {
    render(<NavigationDrawer {...defaultProps} />);
    
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveAttribute('tabIndex', '-1');
  });

  it('prevents body scroll when open', () => {
    render(<NavigationDrawer {...defaultProps} />);
    
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when closed', () => {
    const { rerender } = render(<NavigationDrawer {...defaultProps} />);
    
    rerender(<NavigationDrawer {...defaultProps} isOpen={false} />);
    
    expect(document.body.style.overflow).toBe('unset');
  });

  it('shows visual feedback during drag', () => {
    render(<NavigationDrawer {...defaultProps} />);
    
    const drawer = screen.getByRole('dialog');
    
    fireEvent.touchStart(drawer, {
      touches: [{ clientX: 200, clientY: 100 }]
    });
    
    fireEvent.touchMove(drawer, {
      touches: [{ clientX: 150, clientY: 100 }]
    });
    
    // Check for visual feedback element
    const feedbackElement = document.querySelector('.absolute.top-0.bottom-0.w-1.bg-primary-500');
    expect(feedbackElement).toBeInTheDocument();
  });
});