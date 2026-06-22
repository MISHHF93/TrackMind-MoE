import type { ReactElement } from 'react';
import { TextInput, type TextInputProps } from './TextInput';

export type DateTimeInputMode = 'date' | 'datetime-local' | 'time';

export function DateTimeInput({
  mode = 'datetime-local',
  ...rest
}: Omit<TextInputProps, 'type'> & { mode?: DateTimeInputMode }): ReactElement {
  return <TextInput type={mode} {...rest} />;
}
