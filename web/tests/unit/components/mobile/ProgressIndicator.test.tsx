import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressIndicator from '../../../../src/components/mobile/ProgressIndicator';

const mockSteps = [
  { label: 'Step 1', completed: true },
  { label: 'Step 2', current: true },
  { label: 'Step 3', completed: false },
];

describe('ProgressIndicator', () => {
  it('renders all steps', () => {
    render(<ProgressIndicator steps={mockSteps} variant="linear" />);

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('linear variant renders progress bars', () => {
    render(<ProgressIndicator steps={mockSteps} variant="linear" />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1'); // 1 completed
    expect(progressbar).toHaveAttribute('aria-valuemax', '3');
  });

  it('circular variant renders numbered circles', () => {
    render(<ProgressIndicator steps={mockSteps} variant="circular" />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
  });

  it('completed steps show checkmark in circular variant', () => {
    render(<ProgressIndicator steps={mockSteps} variant="circular" />);

    const circles = screen.getAllByRole('img', { hidden: true });
    expect(circles.length).toBeGreaterThan(0);
  });

  it('dark mode support on progress bars', () => {
    render(<ProgressIndicator steps={mockSteps} variant="linear" />);

    const progressbar = screen.getByRole('progressbar');
    const bars = progressbar.querySelectorAll('[class*="dark:"]');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('steps have accessibility labels', () => {
    render(<ProgressIndicator steps={mockSteps} variant="circular" />);

    // Check that step labels are accessible
    expect(screen.getByLabelText(/Step 1.*Complete/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Step 2.*Current/)).toBeInTheDocument();
  });
});
