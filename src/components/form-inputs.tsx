import { Ionicons } from '@expo/vector-icons';
import { createElement, useRef } from 'react';
import { Platform, TextInput } from 'react-native';

import { C } from '@/components/ui';

const box = {
  minHeight: 46, borderRadius: 16, border: '1px solid rgba(255,255,255,0.95)', backgroundColor: 'rgba(255,255,255,0.72)',
  boxShadow: 'inset 0 1px 3px rgba(92,74,66,0.12)', padding: '0 14px', fontSize: 15.5, color: C.text, fontFamily: 'inherit', boxSizing: 'border-box',
  width: '100%', maxWidth: '100%', minWidth: 0,
};

// "YYYY-MM-DD" -> "DD/MM/YYYY". The input's underlying value is always this ISO format regardless
// of device locale — only the browser's own on-screen rendering of it varies by device (see below).
const displayDate = (ymd: string) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');

/** type="date" or "time": native pickers on the web, plain text box elsewhere. */
export function NativePickerInput({
  type, value, onChange, label,
}: { type: 'date' | 'time'; value: string; onChange: (v: string) => void; label: string }) {
  const inputRef = useRef<{ showPicker?: () => void; focus: () => void } | null>(null);
  if (Platform.OS === 'web') {
    // Safari/iOS renders a native date input's VALUE using the device's own language & region
    // settings, no matter what `lang`/`dir` we set on the element — on Tamar's phone that showed up
    // as "2026 בנוב' 15" instead of "15/11/2026". The fix: make the native input invisible but still
    // tappable (it still opens the normal OS date/time picker), and show our own fixed-format text
    // in a plain box underneath it, so what's actually on screen never depends on device settings.
    return createElement(
      'div',
      {
        // Tapping anywhere in the frame opens the picker (desktop browsers otherwise only react to the tiny built-in icon).
        style: { position: 'relative', width: '100%', cursor: 'pointer' },
        onClick: () => { try { if (inputRef.current?.showPicker) inputRef.current.showPicker(); else inputRef.current?.focus(); } catch { inputRef.current?.focus(); } },
      },
      createElement(
        'div',
        { style: { ...box, display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr', justifyContent: 'flex-start' } },
        createElement(Ionicons, { name: type === 'date' ? 'calendar-outline' : 'time-outline', size: 16, color: C.textMuted }),
        type === 'date' ? displayDate(value) : value,
      ),
      createElement('input', {
        ref: inputRef, type, value, 'aria-label': label,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 'none', margin: 0, padding: 0, cursor: 'pointer' },
      }),
    );
  }
  return (
    <TextInput
      value={value} onChangeText={onChange} accessibilityLabel={label}
      placeholder={type === 'date' ? 'YYYY-MM-DD' : 'HH:MM'}
      style={{ minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 15.5 }}
    />
  );
}
