import { act, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';

let dark = false;
const media = new EventTarget();
function Consumer({ label }: { label: string }) {
  const { theme, preference, setTheme, toggleTheme } = useTheme();
  return <div><output aria-label={label}>{preference}:{theme}</output>
    <button onClick={toggleTheme}>Alternar {label}</button>
    <button onClick={() => setTheme('system')}>Sistema {label}</button></div>;
}
beforeEach(() => {
  dark = false; localStorage.clear(); document.documentElement.className = '';
  vi.stubGlobal('matchMedia', () => ({ get matches() { return dark; }, addEventListener: media.addEventListener.bind(media), removeEventListener: media.removeEventListener.bind(media) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('theme preference', () => {
  it('synchronizes mounted consumers and persists explicit selection', () => {
    render(<><Consumer label="A" /><Consumer label="B" /></>);
    act(() => screen.getByText('Alternar A').click());
    expect(screen.getByLabelText('A')).toHaveTextContent('dark:dark');
    expect(screen.getByLabelText('B')).toHaveTextContent('dark:dark');
    expect(localStorage.getItem('gai.theme')).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
  it('reacts to system changes only when the system preference is selected', () => {
    render(<Consumer label="A" />);
    act(() => { dark = true; media.dispatchEvent(new Event('change')); });
    expect(screen.getByLabelText('A')).toHaveTextContent('system:dark');
    act(() => screen.getByText('Alternar A').click());
    act(() => { dark = false; media.dispatchEvent(new Event('change')); dark = true; media.dispatchEvent(new Event('change')); });
    expect(screen.getByLabelText('A')).toHaveTextContent('light:light');
    act(() => screen.getByText('Sistema A').click());
    expect(screen.getByLabelText('A')).toHaveTextContent('system:dark');
  });
  it('handles cross-tab storage updates and cleared preferences', () => {
    render(<Consumer label="A" />);
    act(() => { localStorage.setItem('gai.theme', 'dark'); window.dispatchEvent(new StorageEvent('storage', { key: 'gai.theme', newValue: 'dark' })); });
    expect(document.documentElement).toHaveClass('dark');
    act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null })); });
    expect(screen.getByLabelText('A')).toHaveTextContent('system:light');
  });
  it('still changes theme when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
    render(<Consumer label="A" />);
    act(() => screen.getByText('Alternar A').click());
    expect(document.documentElement).toHaveClass('dark');
  });
});
