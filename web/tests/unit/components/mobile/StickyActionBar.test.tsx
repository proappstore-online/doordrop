import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StickyActionBar from '../../../../src/components/mobile/StickyActionBar';

const mockActions = [
  { label: 'Cancel', onClick: vi.fn(), variant: 'secondary' as const },
  { label: 'Submit', onClick: vi.fn(), variant: 'primary' as const },
];

describe('StickyActionBar', () => {
  it('renders all action buttons', () => {
    render(<StickyActionBar actions={mockActions} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('has action bar region role', () => {
    render(<StickyActionBar actions={mockActions} />);

    expect(screen.getByRole('region', { name: 'Action bar' })).toBeInTheDocument();
  });

  it('buttons are touch-friendly (at least 44px height)', () => {
    render(<StickyActionBar actions={mockActions} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toHaveClass('h-12'); // 3rem = 48px
    });
  });

  it('calls onClick handlers when buttons are clicked', () => {
    const onClick1 = vi.fn();
    const onClick2 = vi.fn();

    render(
      <StickyActionBar
        actions={[
          { label: 'Action 1', onClick: onClick1 },
          { label: 'Action 2', onClick: onClick2 },
        ]}
      />
    );

    fireEvent.click(screen.getByText('Action 1'));
    expect(onClick1).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Action 2'));
    expect(onClick2).toHaveBeenCalled();
  });

  it('disables buttons when disabled flag is set', () => {
    render(
      <StickyActionBar
        actions={[
          { label: 'Disabled', onClick: vi.fn(), disabled: true },
        ]}
      />
    );

    const btn = screen.getByText('Disabled');
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
  });

  it('shows loading state when loading flag is set', () => {
    render(
      <StickyActionBar
        actions={[
          { label: 'Submit', onClick: vi.fn(), loading: true },
        ]}
      />
    );

    const btn = screen.getByText('Submit');
    expect(btn).toBeDisabled();
    const spinner = btn.querySelector('svg');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('supports safe-area inset for notched devices', () => {
    render(<StickyActionBar actions={mockActions} />);

    const region = screen.getByRole('region');
    const style = region.getAttribute('style');
    expect(style).toContain('safe-area-inset-bottom');
  });

  it('applies variant-specific styles', () => {
    render(
      <StickyActionBar
        actions={[
          { label: 'Primary', onClick: vi.fn(), variant: 'primary' },
          { label: 'Secondary', onClick: vi.fn(), variant: 'secondary' },
          { label: 'Danger', onClick: vi.fn(), variant: 'danger' },
        ]}
      />
    );

    const primaryBtn = screen.getByText('Primary');
    const secondaryBtn = screen.getByText('Secondary');
    const dangerBtn = screen.getByText('Danger');

    expect(primaryBtn).toHaveClass('bg-emerald-600');
    expect(secondaryBtn).toHaveClass('border');
    expect(dangerBtn).toHaveClass('bg-red-600');
  });
});
