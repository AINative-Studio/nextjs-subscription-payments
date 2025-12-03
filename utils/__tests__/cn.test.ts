/**
 * Tests for cn utility (className merger)
 */

import { cn } from '../cn';

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    const result = cn('btn', 'btn-primary');
    expect(result).toBe('btn btn-primary');
  });

  it('should handle conditional classes', () => {
    const result = cn('btn', false && 'hidden', 'active');
    expect(result).toBe('btn active');
  });

  it('should merge tailwind classes correctly', () => {
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['btn', 'btn-primary'], 'active');
    expect(result).toBe('btn btn-primary active');
  });

  it('should handle objects with boolean values', () => {
    const result = cn({
      btn: true,
      'btn-primary': true,
      hidden: false,
    });
    expect(result).toBe('btn btn-primary');
  });

  it('should handle empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle null and undefined', () => {
    const result = cn('btn', null, undefined, 'active');
    expect(result).toBe('btn active');
  });

  it('should merge complex tailwind classes', () => {
    const result = cn(
      'bg-red-500 text-white',
      'bg-blue-500',
      'hover:bg-green-500'
    );
    expect(result).toBe('text-white bg-blue-500 hover:bg-green-500');
  });

  it('should handle multiple conflicting classes', () => {
    const result = cn('p-4 m-2', 'p-8');
    expect(result).toBe('m-2 p-8');
  });
});
