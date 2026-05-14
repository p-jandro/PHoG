import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AutocompletePicker } from './AutocompletePicker';

const roster = [
  { name: 'Squirtle' },
  { name: 'Bulbasaur' },
  { name: 'Charmander', aliases: ['Char'] },
  { name: 'Stantler' }
];

describe('AutocompletePicker startsWith filter', () => {
  it('shows only names starting with the typed prefix', () => {
    render(<AutocompletePicker roster={roster} onSubmit={() => {}} />);
    const input = screen.getByPlaceholderText('Type a name…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 's' } });
    expect(screen.getByText('Squirtle')).toBeInTheDocument();
    expect(screen.getByText('Stantler')).toBeInTheDocument();
    expect(screen.queryByText('Bulbasaur')).not.toBeInTheDocument();
    expect(screen.queryByText('Charmander')).not.toBeInTheDocument();
  });

  it('respects aliases for startsWith', () => {
    render(<AutocompletePicker roster={roster} onSubmit={() => {}} />);
    const input = screen.getByPlaceholderText('Type a name…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'cha' } });
    expect(screen.getByText('Charmander')).toBeInTheDocument();
  });
});
