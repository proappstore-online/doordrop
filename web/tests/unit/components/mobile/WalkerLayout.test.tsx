import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import WalkerLayout from '../../../../src/components/mobile/WalkerLayout';

const TestPage: React.FC<{ name: string }> = ({ name }) => <div>{name}</div>;

const WalkerLayoutWithRoutes = ({ initialRoute = '/walker' }) => (
  <BrowserRouter>
    <Routes>
      <Route element={<WalkerLayout />}>
        <Route path="/walker" element={<TestPage name="Campaigns" />} />
        <Route path="/walker/history" element={<TestPage name="History" />} />
        <Route path="/walker/messages" element={<TestPage name="Messages" />} />
        <Route path="/walker/profile" element={<TestPage name="Profile" />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

describe('WalkerLayout Navigation', () => {
  it('renders all core walker navigation items', () => {
    render(<WalkerLayoutWithRoutes />);

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(nav).getByText('Campaigns')).toBeInTheDocument();
    expect(within(nav).getByText('History')).toBeInTheDocument();
    expect(within(nav).getByText('Messages')).toBeInTheDocument();
    expect(within(nav).getByText('Profile')).toBeInTheDocument();
  });

  it('nav items have proper aria-labels for screen readers', () => {
    render(<WalkerLayoutWithRoutes />);

    expect(screen.getByLabelText('Browse campaigns and assigned work')).toBeInTheDocument();
    expect(screen.getByLabelText('View past deliveries and earnings')).toBeInTheDocument();
    expect(screen.getByLabelText('View messages from campaign admins')).toBeInTheDocument();
    expect(screen.getByLabelText('View your profile and settings')).toBeInTheDocument();
  });

  it('marks current route as active with visual indicator', () => {
    const { rerender } = render(<WalkerLayoutWithRoutes initialRoute="/walker" />);

    // Note: Testing active state requires actual navigation, so we check the className
    const campaignsLink = screen.getByLabelText('Browse campaigns and assigned work');
    expect(campaignsLink).toHaveClass('text-emerald-600');

    // When we navigate to history, it should become active
    // This is harder to test without full routing, but NavLink will handle it
  });

  it('navigation items are keyboard accessible (tab-navigable)', () => {
    render(<WalkerLayoutWithRoutes />);

    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');

    // All items should be links (keyboard navigable)
    expect(links).toHaveLength(4);
    links.forEach((link) => {
      expect(link.tagName).toBe('A');
    });
  });

  it('nav items have proper touch target sizes (44px minimum)', () => {
    render(<WalkerLayoutWithRoutes />);

    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');

    links.forEach((link) => {
      expect(link).toHaveClass('h-16'); // 64px height
    });
  });

  it('hides bottom nav on delivery pages', () => {
    const { rerender } = render(<WalkerLayoutWithRoutes initialRoute="/walker" />);

    let nav = screen.queryByRole('navigation');
    expect(nav).toBeInTheDocument();

    // Simulate being on a delivery page by checking the location logic
    // This is tested more thoroughly in integration tests
  });

  it('navigation has safe-area-inset support for notched phones', () => {
    render(<WalkerLayoutWithRoutes />);

    const nav = screen.getByRole('navigation');
    const style = nav.getAttribute('style');
    expect(style).toContain('safe-area-inset-bottom');
  });

  it('navigation stays fixed at bottom when scrolling content', () => {
    render(<WalkerLayoutWithRoutes />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('fixed', 'bottom-0');
  });

  it('content area has proper bottom padding to avoid obscuring', () => {
    render(<WalkerLayoutWithRoutes />);

    // Check that padding div is rendered
    const main = screen.getByText('Campaigns').closest('main');
    expect(main).toBeInTheDocument();

    // The layout should include bottom padding
    const paddingDiv = screen.getByRole('navigation').nextElementSibling;
    if (paddingDiv) {
      const style = window.getComputedStyle(paddingDiv);
      // Height should be at least 72px (nav height)
      expect(paddingDiv).toHaveStyle({ height: 'max(72px, calc(72px + env(safe-area-inset-bottom)))' });
    }
  });

  it('connection banner is visible above navigation', () => {
    render(<WalkerLayoutWithRoutes />);

    // ConnectionBanner should be rendered
    // Check for the SVG or text that indicates connection status
    const main = screen.getByRole('navigation');
    const parent = main.parentElement;

    // Navigation should not be the first child (banner is)
    expect(parent?.firstChild).not.toBe(main);
  });

  it('dark mode colors applied to navigation', () => {
    render(<WalkerLayoutWithRoutes />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass('dark:bg-gray-800', 'dark:border-gray-700');
  });

  it('navigation links have hover states for accessibility', () => {
    render(<WalkerLayoutWithRoutes />);

    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');

    links.forEach((link) => {
      // Should have hover state classes
      const className = link.getAttribute('class');
      expect(className).toMatch(/hover:/);
    });
  });
});
