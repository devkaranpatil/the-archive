export const normalise = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
export const letters = (s) => normalise(s).toUpperCase();
