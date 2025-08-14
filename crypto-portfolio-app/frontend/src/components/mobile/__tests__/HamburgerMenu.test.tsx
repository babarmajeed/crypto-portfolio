import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HamburgerMenu from '../HamburgerMenu';

describe('HamburgerMenu', () => {
  const defaultProps = {
    isOpen: false,
    onClick: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with correct default state', () => {
    render(<HamburgerMenu {...defaultProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-label', 'Toggle navigation menu');
  });

  it('renders in open state', () => {
    render(<HamburgerMenu {...defaultProps} isOpen={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<HamburgerMenu {...defaultProps} onClick={onClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const customClass = 'custom-hamburger';
    render(<HamburgerMenu {...defaultProps} className={customClass} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass(customClass);
  });

  it('supports different sizes', () => {
    const { rerender } = render(<HamburgerMenu {...defaultProps} size="sm" />);
    let button = screen.getByRole('button');
    let container = button.querySelector('div');
    expect(container).toHaveClass('w-5', 'h-5');

    rerender(<HamburgerMenu {...defaultProps} size="md" />);
    button = screen.getByRole('button');
    container = button.querySelector('div');
    expect(container).toHaveClass('w-6', 'h-6');

    rerender(<HamburgerMenu {...defaultProps} size="lg" />);
    button = screen.getByRole('button');
    container = button.querySelector('div');
    expect(container).toHaveClass('w-8', 'h-8');
  });

  it('applies custom color', () => {
    const customColor = '#ff0000';
    render(<HamburgerMenu {...defaultProps} color={customColor} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ color: customColor });
  });

  it('has custom aria label', () => {
    const customLabel = 'Open main menu';
    render(<HamburgerMenu {...defaultProps} ariaLabel={customLabel} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', customLabel);
  });

  it('shows correct screen reader text', () => {
    const { rerender } = render(<HamburgerMenu {...defaultProps} isOpen={false} />);
    expect(screen.getByText('Open menu')).toBeInTheDocument();

    rerender(<HamburgerMenu {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Close menu')).toBeInTheDocument();
  });

  it('has proper keyboard support', () => {
    const onClick = jest.fn();
    render(<HamburgerMenu {...defaultProps} onClick={onClick} />);
    
    const button = screen.getByRole('button');
    
    // Enter key
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Space key
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('animates hamburger lines correctly', () => {
    const { rerender } = render(<HamburgerMenu {...defaultProps} isOpen={false} />);
    
    let lines = document.querySelectorAll('span');
    expect(lines).toHaveLength(3);
    
    // Check closed state classes
    expect(lines[0]).not.toHaveClass('rotate-45');
    expect(lines[1]).not.toHaveClass('opacity-0');
    expect(lines[2]).not.toHaveClass('-rotate-45');

    // Check open state
    rerender(<HamburgerMenu {...defaultProps} isOpen={true} />);
    lines = document.querySelectorAll('span');
    
    expect(lines[0]).toHaveClass('rotate-45');
    expect(lines[1]).toHaveClass('opacity-0');
    expect(lines[2]).toHaveClass('-rotate-45');
  });
});