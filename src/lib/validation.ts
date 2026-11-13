/** A number typed by the user: its value once valid, or why it is not. */
export interface Reading {
  value: number | null;
  error: string | null;
}

/** Reads a whole number typed between `min` and `max`. An empty field is neither a value nor an error. */
export function readWholeNumber(text: string, min: number, max: number): Reading {
  const typed = text.trim();
  if (!typed) return { value: null, error: null };
  if (/\p{L}/u.test(typed)) return { value: null, error: "Solo se admiten números, sin letras." };
  if (/\D/.test(typed)) {
    return { value: null, error: "Escribe un número entero, sin espacios, signos ni decimales." };
  }
  const value = Number(typed);
  if (value < min || value > max) return { value: null, error: `Elige un número entre ${min} y ${max}.` };
  return { value, error: null };
}
