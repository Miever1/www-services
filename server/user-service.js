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

//Delete a user (should only be accessible from user page)
const deleteUser = async (id) => {
  const result = await sql`DELETE FROM users WHERE id=${id} RETURNING *;`;

  console.log(result);
}

export { createUser, getUserFromEmail, updateUser, deleteUser }