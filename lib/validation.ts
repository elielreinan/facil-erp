export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskCnpj(value: string): string {
  const digits = digitsOnly(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function isValidCnpj(value: string): boolean {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calculateDigit = (base: string): number => {
    let factor = base.length - 5;
    const sum = Array.from(base).reduce((total, digit) => {
      const result = total + Number(digit) * factor;
      factor = factor === 2 ? 9 : factor - 1;
      return result;
    }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(cnpj.slice(0, 12)) === Number(cnpj[12])
    && calculateDigit(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

export function isSafeText(value: string, maxLength: number): boolean {
  return value.trim().length > 0
    && value.length <= maxLength
    && !/[<>`]/.test(value);
}

export function normalizeSearch(value: string, maxLength = 100): string {
  return value.trim().slice(0, maxLength);
}
