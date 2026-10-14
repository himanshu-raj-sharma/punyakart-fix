export const NGO_DETAILS = {
  name: 'Punyakart Foundation',
  address: '59/22, Near SBI Bank, Moti Bazar, Dehradun - 248001',
  phone: '+91 9105155556',
  email: 'info@punyakart.com',
  website: 'https://punyakart.com',
  panNumber80G: '',
  taxBenefit: '50% Deduction under Section 80G of Income Tax Act 1961',
};

export const NGO_UPI_VPA = (import.meta as any).env?.VITE_NGO_UPI_VPA || 'ngo@upi';

const PLACEHOLDER = /AAATD1234|your_|Pending registration/i;

export function formatRegistration(value?: string, fallback = 'Shown on your official 80G certificate'): string {
  const trimmed = (value || '').trim();
  if (!trimmed || PLACEHOLDER.test(trimmed)) return fallback;
  return trimmed;
}

export async function hydrateNgoDetails(): Promise<void> {
  try {
    const res = await fetch('/api/public/ngo');
    if (!res.ok) return;
    const data = (await res.json()) as {
      certificate?: {
        panNumber80G?: string;
        taxBenefit?: string;
        email?: string;
      };
    };
    const cert = data.certificate;
    if (!cert) return;
    if (cert.panNumber80G) NGO_DETAILS.panNumber80G = cert.panNumber80G;
    if (cert.taxBenefit) NGO_DETAILS.taxBenefit = cert.taxBenefit;
    if (cert.email) NGO_DETAILS.email = cert.email;
  } catch {
    // keep local defaults
  }
}

