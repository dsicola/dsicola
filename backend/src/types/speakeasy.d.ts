declare module 'speakeasy' {
  interface GenerateSecretOptions {
    name?: string;
    issuer?: string;
    length?: number;
  }

  interface GeneratedSecret {
    ascii?: string;
    hex?: string;
    base32?: string;
    qr_code_ascii?: string;
    qr_code_hex?: string;
    qr_code_base32?: string;
    google_auth_qr?: string;
    otpauth_url?: string;
  }

  interface VerifyOptions {
    secret: string;
    encoding?: string;
    token: string;
    window?: number;
  }

  interface TotpVerifyOptions {
    secret: string;
    encoding?: string;
    token: string;
    window?: number;
  }

  export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;
  export function verify(options: VerifyOptions): boolean;
  export const totp: {
    verify(options: TotpVerifyOptions): boolean;
  };
}
