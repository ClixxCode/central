export { auth, signIn, signOut, handlers } from './config';
export { hashPassword, verifyPassword, validatePassword } from './password';
export {
  getSession,
  getCurrentUser,
  requireAuth,
  requireAdmin,
  isAuthenticated,
  isAdmin,
  type SessionUser,
} from './session';

// Re-export types
import './types';
