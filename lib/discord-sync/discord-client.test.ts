import { expect, test, vi } from 'vitest';

import { MAX_SELECT_OPTIONS, toSelectOptions } from '@/lib/discord-sync/discord-client';

function roster(size: number) {
  return Array.from({ length: size }, (_, index) => {
    const value = `사람${index + 1}`;
    return { label: value, value };
  });
}

test('passes a normal roster through untouched', () => {
  const options = roster(12);
  expect(toSelectOptions(options)).toEqual(options);
});

test('clamps a roster that outgrew the Discord select limit', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const clamped = toSelectOptions(roster(30));

  expect(clamped).toHaveLength(MAX_SELECT_OPTIONS);
  expect(clamped.at(-1)?.value).toBe('사람25');
  expect(warn).toHaveBeenCalled();

  warn.mockRestore();
});

test('truncates labels and values Discord would reject', () => {
  const long = 'ㄱ'.repeat(150);

  const [option] = toSelectOptions([{ label: long, value: long }]);

  expect(option.label).toHaveLength(100);
  expect(option.value).toHaveLength(100);
});
