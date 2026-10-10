import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BottomNav from '../../../../src/components/mobile/BottomNav';

const mockItems = [
  {
    path: '/test1',
    label: 'Test 1',
    ariaLabel: 'Test 1 page',
    icon: <span>Icon1</span>,
  },
  {
    path: '/test2',
    label: 'Test 2',
    ariaLabel: 'Test 2 page',
    icon: <span>Icon2</span>,
  },
];

describe('BottomNav', () => {
  it('renders all nav items', () => {
    render(
      <BrowserRouter>
        <BottomNav items={mockItems} />
      </BrowserRouter>
    );

    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.getByText('Test 2')).toBeInTheDocument();
  });

  it('has proper ARIA navigation role', () => {
    render(
      <BrowserRouter>
        <BottomNav items={mockItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(nav).toBeInTheDocument();
  });

  it('items have touch-friendly height (at least 44px)', () => {
    render(
      <BrowserRouter>
        <BottomNav items={mockItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation');
    const style = window.getComputedStyle(nav);
    expect(nav.querySelector('a')).toHaveClass('h-16'); // 4rem = 64px
  });

  it('supports safe-area inset for notched devices', () => {
    render(
      <BrowserRouter>
        <BottomNav items={mockItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation');
    const style = nav.getAttribute('style');
    expect(style).toContain('safe-area-inset-bottom');
  });

  it('items have proper aria-labels', () => {
    render(
      <BrowserRouter>
        <BottomNav items={mockItems} />
      </BrowserRouter>
    );

    expect(screen.getByLabelText('Test 1 page')).toBeInTheDocument();
    expect(screen.getByLabelText('Test 2 page')).toBeInTheDocument();
  });
});
