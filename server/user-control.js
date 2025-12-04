import * as userService from "./user-service.js";

// Get user by ID
const showUser = async (c) => {
  try {
    const id = c.req.param('id');
    
    if (!id) {
      return c.json({ error: 'User ID is required' }, 400);
    }
    
    const user = await userService.readUser(id);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Don't return sensitive information
    const { password_hash, ...safeUser } = user;
    
    return c.json(safeUser, 200);
  } catch (error) {
    console.error('Error getting user:', error);
    return c.json({ error: 'Failed to get user', message: error.message }, 500);
  }
};

export { showUser };

