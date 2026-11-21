import { Pipe, PipeTransform } from '@angular/core';

/** Turns a backend enum value into a label: `ALL_LEVELS` → `All levels`, `NGO` → `NGO`. */
@Pipe({ name: 'enumLabel' })
export class EnumLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    // Short values such as NGO are acronyms: keep them as they are.
    if (value.length <= 3) {
      return value;
    }
    const words = value.toLowerCase().replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
