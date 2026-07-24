export type Role = 'customer' | 'manager';

export type UserRecord = {
  uid: string;
  email: string;
  passwordHash: string;
  role: Role;
  marketingOptIn: boolean;
  emailVerified: boolean;
  createdAt: Date;
};
