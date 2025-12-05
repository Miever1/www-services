import * as userService from "./user-service.js";

// Get current user's profile
const getProfile = async (c) => {
  // Get user from context (set by middleware)
  if (!c.user || !c.user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await userService.getUserById(c.user.id);
  
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Don't return sensitive information like password_hash
  const { password_hash, ...profile } = user;
  return c.json(profile, 200);
}

// Update current user's profile
const updateProfile = async (c) => {
  // Get user from context (set by middleware)
  if (!c.user || !c.user.id) {
    console.log("Profile update: Unauthorized - no user in context");
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    let body;
    try {
      body = await c.req.json();
      console.log("Profile update: Received body for user", c.user.id, "Fields:", Object.keys(body));
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return c.json({ error: "Invalid request body. Expected JSON format." }, 400);
    }
    
    // Allow updating profile fields (not password here)
    const updateData = {};
    if (body.username !== undefined && body.username !== null) {
      updateData.username = body.username;
    }
    if (body.email !== undefined && body.email !== null) {
      updateData.email = body.email;
    }
    if (body.name !== undefined && body.name !== null) {
      updateData.name = body.name;
    }
    if (body.bio !== undefined && body.bio !== null) {
      updateData.bio = body.bio;
    }
    if (body.address !== undefined && body.address !== null) {
      updateData.address = body.address;
    }
    if (body.phone !== undefined && body.phone !== null) {
      updateData.phone = body.phone;
    }
    if (body.avatar_url !== undefined && body.avatar_url !== null) {
      // Truncate avatar_url if it's too long for logging
      const avatarPreview = body.avatar_url.length > 50 
        ? body.avatar_url.substring(0, 50) + "..." 
        : body.avatar_url;
      console.log("Profile update: Avatar URL length:", body.avatar_url.length, "Preview:", avatarPreview);
      updateData.avatar_url = body.avatar_url;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      console.log("Profile update: No fields to update, returning current profile");
      const currentUser = await userService.getUserById(c.user.id);
      if (!currentUser) {
        return c.json({ error: "User not found" }, 404);
      }
      const { password_hash, ...profile } = currentUser;
      return c.json(profile, 200);
    }

    console.log("Profile update: Updating fields:", Object.keys(updateData));

    // Update user profile
    const updatedUser = await userService.updateUserProfile(c.user.id, updateData);
    
    if (!updatedUser) {
      console.error("Profile update: Failed to update profile - updateUserProfile returned null");
      return c.json({ error: "Failed to update profile" }, 500);
    }

    console.log("Profile update: Successfully updated profile for user", c.user.id);

    // Don't return sensitive information
    const { password_hash, ...profile } = updatedUser;
    
    // Ensure response is valid JSON - log if avatar_url is very large
    if (profile.avatar_url && profile.avatar_url.length > 1000000) {
      console.log("Profile update: Warning - avatar_url is very large (", profile.avatar_url.length, "bytes)");
    }
    
    // Return JSON response
    return c.json(profile, 200);
  } catch (error) {
    console.error("Error updating profile:", error);
    console.error("Error stack:", error.stack);
    return c.json({ 
      error: "Internal server error", 
      message: error.message || "An unexpected error occurred" 
    }, 500);
  }
}

export { getProfile, updateProfile }

