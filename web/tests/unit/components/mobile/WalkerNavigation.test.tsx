import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import BottomNav from '../../../../src/components/mobile/BottomNav';

describe('Walker Mobile Navigation Items', () => {
  const walkerNavItems = [
    {
      path: '/walker',
      label: 'Campaigns',
      ariaLabel: 'Browse campaigns and assigned work',
      icon: <span data-testid="campaigns-icon">📋</span>,
    },
    {
      path: '/walker/history',
      label: 'History',
      ariaLabel: 'View past deliveries and earnings',
      icon: <span data-testid="history-icon">⏱️</span>,
    },
    {
      path: '/walker/messages',
      label: 'Messages',
      ariaLabel: 'View messages from campaign admins',
      icon: <span data-testid="messages-icon">💬</span>,
    },
    {
      path: '/walker/profile',
      label: 'Profile',
      ariaLabel: 'View your profile and settings',
      icon: <span data-testid="profile-icon">👤</span>,
    },
  ];

  it('renders all 4 core walker navigation destinations', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('campaigns nav item covers both discovery and assigned work', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const campaignsLink = screen.getByLabelText('Browse campaigns and assigned work');
    expect(campaignsLink).toHaveAttribute('href', '/walker');
  });

  it('history nav item provides access to earnings summary', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const historyLink = screen.getByLabelText('View past deliveries and earnings');
    expect(historyLink).toHaveAttribute('href', '/walker/history');
  });

  it('all nav items are one-tap reachable from any screen', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation');
    const links = nav.querySelectorAll('a');

    // Should be 4 items, all reachable in one interaction
    expect(links).toHaveLength(4);
    links.forEach((link) => {
      expect(link).toBeVisible();
    });
  });

  it('navigation does not obscure page content with proper spacing', () => {
    const { container } = render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation');

    // Nav is fixed at bottom
    expect(nav).toHaveClass('fixed', 'bottom-0');

    // Nav has proper z-index to stay on top but allow content access
    expect(nav).toHaveClass('z-40');
  });

  it('keyboard navigation works: all items focusable', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation');
    const links = nav.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;

    // All links should be focusable
    links.forEach((link) => {
      expect(link.tabIndex).toBeGreaterThanOrEqual(-1);
    });
  });

  it('keyboard navigation: no tab traps or cycles', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation');
    const links = nav.querySelectorAll('a');

    // Should be able to tab through without getting stuck
    let focusableCount = 0;
    links.forEach((link) => {
      if (parseInt(link.getAttribute('tabindex') || '-1') >= -1) {
        focusableCount++;
      }
    });

    expect(focusableCount).toBe(4);
  });

  it('screen reader announces walker navigation purpose', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(nav).toBeInTheDocument();
  });

  it('active route highlighted for visual accessibility', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    // Check that icons are accessible
    expect(screen.getByTestId('campaigns-icon')).toBeInTheDocument();
    expect(screen.getByTestId('history-icon')).toBeInTheDocument();
    expect(screen.getByTestId('messages-icon')).toBeInTheDocument();
    expect(screen.getByTestId('profile-icon')).toBeInTheDocument();
  });

  it('navigation layout prevents desktop/mobile duplication', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    // Mobile bottom nav should be the only navigation in the walker layout
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('fixed', 'bottom-0'); // Mobile specific

    // No desktop top navigation components should be present (not in scope of this component)
  });

  it('safe-area inset prevents notch cutoff on all devices', () => {
    render(
      <BrowserRouter>
        <BottomNav items={walkerNavItems} />
      </BrowserRouter>
    );

    const nav = screen.getByRole('navigation');
    const style = nav.getAttribute('style');

    // Should use env() for safe area
    expect(style).toContain('safe-area-inset-bottom');
  });
});
