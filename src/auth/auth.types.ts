import { UserRecord } from '../users/users.types';

export type AuthenticatedUser = Pick<UserRecord, 'uid' | 'email' | 'role'>;

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
