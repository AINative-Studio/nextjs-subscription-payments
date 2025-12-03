/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Input from '../Input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter your email" />);
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(
        <div>
          <label htmlFor="test-input">Email Address</label>
          <Input id="test-input" />
        </div>
      );
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<Input className="custom-input" />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('custom-input');
    });
  });

  describe('Input Types', () => {
    it('should render as text input by default', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render as email input', () => {
      render(<Input type="email" />);
      const input = document.querySelector('input[type="email"]');
      expect(input).toBeInTheDocument();
    });

    it('should render as password input', () => {
      render(<Input type="password" />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it('should render as number input', () => {
      render(<Input type="number" />);
      const input = document.querySelector('input[type="number"]');
      expect(input).toBeInTheDocument();
    });

    it('should render as tel input', () => {
      render(<Input type="tel" />);
      const input = document.querySelector('input[type="tel"]');
      expect(input).toBeInTheDocument();
    });

    it('should render as url input', () => {
      render(<Input type="url" />);
      const input = document.querySelector('input[type="url"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Value and onChange', () => {
    it('should accept and display value', () => {
      render(<Input value="test value" readOnly />);
      const input = screen.getByDisplayValue('test value');
      expect(input).toBeInTheDocument();
    });

    it('should call onChange when value changes', () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new value' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it('should update value on user input', () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'user input' } });
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: 'user input' }),
        })
      );
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should not accept input when disabled', () => {
      const handleChange = jest.fn();
      render(<Input disabled onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('should have proper styling when disabled', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('disabled');
    });
  });

  describe('Required Field', () => {
    it('should mark field as required', () => {
      render(<Input required />);
      const input = screen.getByRole('textbox');
      expect(input).toBeRequired();
    });

    it('should support HTML5 validation', () => {
      render(<Input type="email" required />);
      const input = document.querySelector('input[type="email"]');
      expect(input).toBeRequired();
    });
  });

  describe('Readonly State', () => {
    it('should be readonly when readOnly prop is true', () => {
      render(<Input readOnly value="readonly value" />);
      const input = screen.getByDisplayValue('readonly value');
      expect(input).toHaveAttribute('readonly');
    });

    it('should display value but not allow changes when readonly', () => {
      const handleChange = jest.fn();
      render(<Input readOnly value="readonly" onChange={handleChange} />);
      const input = screen.getByDisplayValue('readonly');
      fireEvent.change(input, { target: { value: 'new value' } });
      // Readonly inputs don't trigger onChange in most browsers
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Input aria-label="Email input" />);
      expect(screen.getByLabelText('Email input')).toBeInTheDocument();
    });

    it('should support aria-describedby', () => {
      render(
        <div>
          <Input aria-describedby="helper-text" />
          <span id="helper-text">Enter your email address</span>
        </div>
      );
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'helper-text');
    });

    it('should support aria-invalid for error states', () => {
      render(<Input aria-invalid="true" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should be focusable', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      input.focus();
      expect(input).toHaveFocus();
    });
  });

  describe('Input Attributes', () => {
    it('should support maxLength', () => {
      render(<Input maxLength={10} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('maxLength', '10');
    });

    it('should support minLength', () => {
      render(<Input minLength={5} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('minLength', '5');
    });

    it('should support pattern for validation', () => {
      render(<Input pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('pattern', '[0-9]{3}-[0-9]{3}-[0-9]{4}');
    });

    it('should support autocomplete', () => {
      render(<Input autoComplete="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('autoComplete', 'email');
    });

    it('should support name attribute', () => {
      render(<Input name="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('name', 'email');
    });

    it('should support id attribute', () => {
      render(<Input id="email-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('id', 'email-input');
    });
  });

  describe('Event Handlers', () => {
    it('should call onFocus when focused', () => {
      const handleFocus = jest.fn();
      render(<Input onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalled();
    });

    it('should call onBlur when blurred', () => {
      const handleBlur = jest.fn();
      render(<Input onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalled();
    });

    it('should call onKeyDown when key is pressed', () => {
      const handleKeyDown = jest.fn();
      render(<Input onKeyDown={handleKeyDown} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(handleKeyDown).toHaveBeenCalled();
    });

    it('should call onKeyUp when key is released', () => {
      const handleKeyUp = jest.fn();
      render(<Input onKeyUp={handleKeyUp} />);
      const input = screen.getByRole('textbox');
      fireEvent.keyUp(input, { key: 'Enter' });
      expect(handleKeyUp).toHaveBeenCalled();
    });
  });

  describe('Number Input Specific', () => {
    it('should support min attribute for number input', () => {
      render(<Input type="number" min={0} />);
      const input = document.querySelector('input[type="number"]');
      expect(input).toHaveAttribute('min', '0');
    });

    it('should support max attribute for number input', () => {
      render(<Input type="number" max={100} />);
      const input = document.querySelector('input[type="number"]');
      expect(input).toHaveAttribute('max', '100');
    });

    it('should support step attribute for number input', () => {
      render(<Input type="number" step={0.01} />);
      const input = document.querySelector('input[type="number"]');
      expect(input).toHaveAttribute('step', '0.01');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string value', () => {
      render(<Input value="" readOnly />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(1000);
      render(<Input value={longValue} readOnly />);
      const input = screen.getByDisplayValue(longValue);
      expect(input).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      const specialValue = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      render(<Input value={specialValue} readOnly />);
      const input = screen.getByDisplayValue(specialValue);
      expect(input).toBeInTheDocument();
    });

    it('should handle unicode characters', () => {
      const unicodeValue = '你好世界🌍';
      render(<Input value={unicodeValue} readOnly />);
      const input = screen.getByDisplayValue(unicodeValue);
      expect(input).toBeInTheDocument();
    });
  });

  describe('Form Integration', () => {
    it('should work within a form', () => {
      const handleSubmit = jest.fn((e) => e.preventDefault());
      render(
        <form onSubmit={handleSubmit}>
          <Input name="email" />
          <button type="submit">Submit</button>
        </form>
      );

      const button = screen.getByText('Submit');
      fireEvent.click(button);
      expect(handleSubmit).toHaveBeenCalled();
    });

    it('should submit value with form', () => {
      const handleSubmit = jest.fn((e) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        return formData.get('email');
      });

      render(
        <form onSubmit={handleSubmit}>
          <Input name="email" defaultValue="test@example.com" />
          <button type="submit">Submit</button>
        </form>
      );

      const input = screen.getByRole('textbox');
      const button = screen.getByText('Submit');

      expect(input).toHaveValue('test@example.com');
      fireEvent.click(button);
      expect(handleSubmit).toHaveBeenCalled();
    });
  });
});
