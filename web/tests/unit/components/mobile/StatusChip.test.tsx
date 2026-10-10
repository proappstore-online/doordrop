import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusChip from '../../../../src/components/mobile/StatusChip';

describe('StatusChip', () => {
  it('renders label and status role', () => {
    render(<StatusChip label="Active" variant="success" />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent('Active');
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(<StatusChip label="Test" variant="success" />);

    let status = screen.getByRole('status');
    expect(status).toHaveClass('bg-emerald-100');

    rerender(<StatusChip label="Test" variant="warning" />);
    status = screen.getByRole('status');
    expect(status).toHaveClass('bg-amber-100');

    rerender(<StatusChip label="Test" variant="error" />);
    status = screen.getByRole('status');
    expect(status).toHaveClass('bg-red-100');
  });

  it('renders icon when provided', () => {
    render(
      <StatusChip
        label="Test"
        variant="success"
        icon={<span data-testid="test-icon">✓</span>}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('supports different sizes', () => {
    const { rerender } = render(<StatusChip label="Test" variant="success" size="sm" />);

    let status = screen.getByRole('status');
    expect(status).toHaveClass('px-2.5', 'py-1', 'text-xs');

    rerender(<StatusChip label="Test" variant="success" size="md" />);
    status = screen.getByRole('status');
    expect(status).toHaveClass('px-3', 'py-1.5', 'text-sm');
  });

  it('has accessible aria-label with status text', () => {
    render(<StatusChip label="Active" variant="success" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Status: Active');
  });

  it('dark mode support', () => {
    render(<StatusChip label="Test" variant="success" />);

    const status = screen.getByRole('status');
    expect(status).toHaveClass('dark:bg-emerald-900/30');
  });
});
