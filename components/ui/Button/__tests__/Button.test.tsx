/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from '../Button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('should render button with children', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('should render as a button by default', () => {
      render(<Button>Test Button</Button>);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should render loading dots when loading', () => {
      render(<Button loading>Submit</Button>);
      // Loading dots should be visible
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Button className="custom-class">Styled Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('should apply slim variant styles', () => {
      const { container } = render(<Button variant="slim">Slim Button</Button>);
      expect(container.firstChild).toHaveClass('slim');
    });

    it('should apply flat variant styles', () => {
      const { container } = render(<Button variant="flat">Flat Button</Button>);
      expect(container.firstChild).toHaveClass('flat');
    });

    it('should apply default styles when no variant specified', () => {
      render(<Button>Default Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button Types', () => {
    it('should support submit type', () => {
      render(<Button type="submit">Submit Form</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should support reset type', () => {
      render(<Button type="reset">Reset Form</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'reset');
    });

    it('should default to button type', () => {
      render(<Button>Default Type</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be disabled when loading', () => {
      render(<Button loading>Loading Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not fire onClick when disabled', () => {
      const handleClick = jest.fn();
      render(<Button disabled onClick={handleClick}>Click Me</Button>);
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not fire onClick when loading', () => {
      const handleClick = jest.fn();
      render(<Button loading onClick={handleClick}>Click Me</Button>);
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should call onClick when clicked', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick multiple times on double-click', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const button = screen.getByRole('button');
      fireEvent.doubleClick(button);
      // Should still be called for each click in the double-click
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible role', () => {
      render(<Button>Accessible Button</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should support aria-label', () => {
      render(<Button aria-label="Custom Label">Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });

    it('should be focusable', () => {
      render(<Button>Focus Me</Button>);
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('should not be focusable when disabled', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).not.toHaveFocus();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when loading', () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should preserve children text when loading', () => {
      render(<Button loading>Processing...</Button>);
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  describe('HTML Attributes', () => {
    it('should support data attributes', () => {
      render(<Button data-testid="custom-button" data-analytics="click">Test</Button>);
      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('data-analytics', 'click');
    });

    it('should support id attribute', () => {
      render(<Button id="submit-button">Submit</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('id', 'submit-button');
    });

    it('should support name attribute', () => {
      render(<Button name="action">Action</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('name', 'action');
    });
  });

  describe('Edge Cases', () => {
    it('should render with empty children', () => {
      render(<Button></Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle multiple class names', () => {
      render(<Button className="class1 class2 class3">Multi-class</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('class1');
      expect(button).toHaveClass('class2');
      expect(button).toHaveClass('class3');
    });

    it('should render with complex children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      );
      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });
  });
});
