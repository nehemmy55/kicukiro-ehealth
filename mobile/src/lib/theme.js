// Colours and type taken from the interface figures in Chapter 5.
import { Platform } from 'react-native';

export const C = {
  green: '#0F5A4A',
  greenDark: '#0A4135',
  greenSoft: '#DCEAE4',
  greenTint: '#EEF4F1',
  amber: '#E3A33A',
  amberDark: '#C98A22',
  amberSoft: '#FBEBD0',
  bg: '#EDF1EE',
  card: '#FFFFFF',
  border: '#D6DED9',
  text: '#16302A',
  muted: '#5D6F69',
  faint: '#9AA8A3',
  red: '#B4462F',
  redSoft: '#F7E1DB',
  blue: '#2F6690',
  blueSoft: '#DCE8F2',
};

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' });

export const STATUS = {
  booked: { label: 'Booked', fg: C.blue, bg: C.blueSoft },
  checked_in: { label: 'Arrived', fg: C.amberDark, bg: C.amberSoft },
  completed: { label: 'Completed', fg: C.green, bg: C.greenSoft },
  cancelled: { label: 'Cancelled', fg: C.muted, bg: '#ECEFED' },
  no_show: { label: 'No-show', fg: C.red, bg: C.redSoft },
};
