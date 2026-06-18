const DEFAULT_STATUS_COLOR = '#6B7280';
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function normalizeStatusColor(color?: string | null): string {
  return color && HEX_COLOR_PATTERN.test(color) ? color : DEFAULT_STATUS_COLOR;
}

export function getStatusBackgroundColor(color?: string | null): string {
  const normalized = normalizeStatusColor(color);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, 0.12)`;
}
