// Re-export authApi as authService for backward compatibility
// This file ensures that imports like "import authService from './services/auth.service'" work correctly
import { authApi } from './api';

// Create a const to ensure proper reference
const authService = authApi;

// Named exports
export { authApi };
export { authService };

// Default export - ensures compatibility with default imports
export default authService;

