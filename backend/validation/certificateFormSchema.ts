import { z } from 'zod';
import { BusinessError } from '../errors';

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const certificateFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Valid email address is required'),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, '').slice(-10))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile number required')),
  address: z.string().trim().min(5, 'Address must be at least 5 characters').max(300),
  panNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(PAN_PATTERN, 'Valid PAN is required (e.g. ABCDE1234F)')),
  referenceId: z
    .string()
    .trim()
    .min(6, 'Enter the receipt / transaction ID from your WhatsApp message'),
});

export type CertificateFormInput = z.infer<typeof certificateFormSchema>;

export function validateCertificateForm(payload: unknown): CertificateFormInput {
  const result = certificateFormSchema.safeParse(payload);
  if (!result.success) {
    const errorDetails = result.error.issues.reduce(
      (acc, err) => {
        acc[err.path.join('.') || 'form'] = err.message;
        return acc;
      },
      {} as Record<string, string>,
    );
    throw new BusinessError('Validation failed', 'VALIDATION_ERROR', errorDetails);
  }
  return result.data;
}
