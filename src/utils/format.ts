export function formatUsdc(amount: number | string) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return value.toFixed(2);
}

export function formatSol(amount: number) {
  if (!Number.isFinite(amount)) {
    return "0.0000";
  }
  return amount >= 1 ? amount.toFixed(3) : amount.toFixed(4);
}

export function formatWhole(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return "0";
  }
  return String(Math.round(amount));
}
