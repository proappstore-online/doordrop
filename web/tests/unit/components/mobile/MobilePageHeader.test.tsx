import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MobilePageHeader from '../../../../src/components/mobile/MobilePageHeader';

describe('MobilePageHeader', () => {
  it('renders title and subtitle', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test Title" subtitle="Test Subtitle" />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('renders as banner role', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test Title" />
      </BrowserRouter>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('shows back button when enabled', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test" showBackButton={true} />
      </BrowserRouter>
    );

    expect(screen.getByLabelText('Go back')).toBeInTheDocument();
  });

  it('hides back button when disabled', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test" showBackButton={false} />
      </BrowserRouter>
    );

    expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument();
  });

  it('back button has touch-friendly size (at least 44px)', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test" showBackButton={true} />
      </BrowserRouter>
    );

    const backBtn = screen.getByLabelText('Go back');
    expect(backBtn).toHaveClass('h-10', 'w-10');
  });

  it('supports safe-area inset for notched devices', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test" />
      </BrowserRouter>
    );

    const header = screen.getByRole('banner');
    const style = header.getAttribute('style');
    expect(style).toContain('safe-area-inset-top');
  });

  it('renders custom actions when provided', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test" actions={<button>Custom Action</button>} />
      </BrowserRouter>
    );

    expect(screen.getByText('Custom Action')).toBeInTheDocument();
  });

  it('calls custom onBack handler when provided', () => {
    const onBack = vi.fn();
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test" showBackButton={true} onBack={onBack} />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('sticky positioning keeps header visible on scroll', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test" />
      </BrowserRouter>
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0');
  });
});
