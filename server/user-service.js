import postgres from "postgres";
/*
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
*/

const sql = postgres();

//Create a new user
const createUser = async (username, email, password_hash) => {
  const id = crypto.randomUUID();
  
  const result = await sql`
    INSERT INTO users (id, username, email, password_hash)
    VALUES (${id}, ${username}, ${email}, ${password_hash})
    RETURNING *;
  `;

  return result;
}

//Get user from email (each user should have a unique email)
const getUserFromEmail = async (email) => {
  const result = await sql`
    SELECT * FROM users
    WHERE email = ${email};
  `;

  return result;
}

//Get user by ID
const getUserById = async (id) => {
  const result = await sql`
    SELECT id, username, email, name, avatar_url, bio, address, phone
    FROM users
    WHERE id = ${id};
  `;

  return result.length > 0 ? result[0] : null;
}

//Update user information (name, email or password) (only accessible from user page)
const updateUser = async (id, userdata) => {
  const { username, email,password_hash } = userdata;

  const result = await sql`
    UPDATE users
    SET username=${username}, email=${email}, password_hash=${password_hash}
    WHERE id=${id}
    RETURNING *;
  `;

  return result;
}

//Update user profile information (partial update - only provided fields)
const updateUserProfile = async (id, userdata) => {
  // Allowed fields (whitelist for security)
  const allowedFields = ['username', 'email', 'name', 'bio', 'address', 'phone', 'avatar_url'];
  
  // Build update parts conditionally using template literals
  let hasUpdates = false;
  let result;
  
  // Check if we have any fields to update
  for (const field of allowedFields) {
    if (userdata[field] !== undefined) {
      hasUpdates = true;
      break;
    }
  }
  
  // If no fields to update, return current user
  if (!hasUpdates) {
    return getUserById(id);
  }
  
  // Build update query with all possible fields using conditional logic
  // This is safer than string concatenation but still allows partial updates
  const updates = [];
  const values = [];
  
  if (userdata.username !== undefined) {
    updates.push('username');
    values.push(userdata.username);
  }
  if (userdata.email !== undefined) {
    updates.push('email');
    values.push(userdata.email);
  }
  if (userdata.name !== undefined) {
    updates.push('name');
    values.push(userdata.name);
  }
  if (userdata.bio !== undefined) {
    updates.push('bio');
    values.push(userdata.bio);
  }
  if (userdata.address !== undefined) {
    updates.push('address');
    values.push(userdata.address);
  }
  if (userdata.phone !== undefined) {
    updates.push('phone');
    values.push(userdata.phone);
  }
  if (userdata.avatar_url !== undefined) {
    updates.push('avatar_url');
    values.push(userdata.avatar_url);
  }
  
  // Use a safer approach with template literal and proper escaping
  // Since we control the field names (whitelist), this is safe
  const setClause = updates.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
  values.push(id); // Add id as last parameter
  
  const query = `UPDATE users SET ${setClause} WHERE id = $${values.length} RETURNING id, username, email, name, avatar_url, bio, address, phone`;
  
  result = await sql.unsafe(query, values);
  return result && result.length > 0 ? result[0] : null;
}

//Delete a user (should only be accessible from user page)
const deleteUser = async (id) => {
  const result = await sql`DELETE FROM users WHERE id=${id} RETURNING *;`;

  console.log(result);
}

export { createUser, getUserFromEmail, getUserById, updateUser, updateUserProfile, deleteUser }