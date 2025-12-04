import postgres from "postgres";

const sql = postgres();

// Create a new message
const createMessage = async (taskId, senderId, receiverId, content) => {
  const id = crypto.randomUUID();
  
  const result = await sql`
    INSERT INTO messages (id, task_id, sender_id, receiver_id, content, created_at)
    VALUES (${id}, ${taskId}::uuid, ${senderId}::uuid, ${receiverId}::uuid, ${content}, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  // Update or create conversation
  await updateConversation(taskId, senderId, receiverId, id);

  return result[0];
};

// Update or create conversation thread
const updateConversation = async (taskId, user1Id, user2Id, messageId) => {
  // Ensure consistent ordering of user IDs for unique constraint
  // Compare UUIDs as strings to ensure consistent ordering
  const user1 = user1Id < user2Id ? user1Id : user2Id;
  const user2 = user1Id < user2Id ? user2Id : user1Id;
  
  // Try to insert or update conversation using ON CONFLICT
  await sql`
    INSERT INTO conversations (task_id, user1_id, user2_id, last_message_at, last_message_id)
    VALUES (${taskId}::uuid, ${user1}::uuid, ${user2}::uuid, CURRENT_TIMESTAMP, ${messageId}::uuid)
    ON CONFLICT (task_id, user1_id, user2_id) DO UPDATE
    SET last_message_at = CURRENT_TIMESTAMP,
        last_message_id = ${messageId}::uuid;
  `;
};

// Get messages for a specific conversation (task + two users)
const getConversationMessages = async (taskId, userId1, userId2) => {
  const [user1, user2] = [userId1, userId2].sort();
  
  const result = await sql`
    SELECT m.*, 
           s.username as sender_username,
           s.name as sender_name,
           s.avatar_url as sender_avatar_url,
           r.username as receiver_username,
           r.name as receiver_name,
           r.avatar_url as receiver_avatar_url
    FROM messages m
    LEFT JOIN users s ON m.sender_id = s.id
    LEFT JOIN users r ON m.receiver_id = r.id
    WHERE m.task_id = ${taskId}::uuid
      AND ((m.sender_id = ${userId1}::uuid AND m.receiver_id = ${userId2}::uuid)
           OR (m.sender_id = ${userId2}::uuid AND m.receiver_id = ${userId1}::uuid))
    ORDER BY m.created_at ASC;
  `;

  return result;
};

// Get all conversations for a user
const getUserConversations = async (userId) => {
  const result = await sql`
    SELECT 
      c.id as conversation_id,
      c.task_id,
      c.last_message_at,
      c.last_message_id,
      CASE 
        WHEN c.user1_id = ${userId}::uuid THEN c.user2_id
        ELSE c.user1_id
      END as other_user_id,
      t.name as task_name,
      t.price as task_price,
      t.time as task_time,
      u.username as other_username,
      u.name as other_name,
      u.avatar_url as other_avatar_url,
      m.content as last_message_content,
      m.created_at as last_message_created_at
    FROM conversations c
    LEFT JOIN tasks t ON c.task_id = t.id
    LEFT JOIN users u ON (
      (c.user1_id = ${userId}::uuid AND c.user2_id = u.id)
      OR (c.user2_id = ${userId}::uuid AND c.user1_id = u.id)
    )
    LEFT JOIN messages m ON c.last_message_id = m.id
    WHERE c.user1_id = ${userId}::uuid OR c.user2_id = ${userId}::uuid
    ORDER BY c.last_message_at DESC;
  `;

  return result;
};

// Mark message as read
const markMessageAsRead = async (messageId, userId) => {
  const result = await sql`
    UPDATE messages
    SET read_at = CURRENT_TIMESTAMP
    WHERE id = ${messageId}::uuid
      AND receiver_id = ${userId}::uuid
      AND read_at IS NULL
    RETURNING *;
  `;

  return result[0];
};

// Mark all messages in a conversation as read
const markConversationAsRead = async (taskId, userId, otherUserId) => {
  const result = await sql`
    UPDATE messages
    SET read_at = CURRENT_TIMESTAMP
    WHERE task_id = ${taskId}::uuid
      AND sender_id = ${otherUserId}::uuid
      AND receiver_id = ${userId}::uuid
      AND read_at IS NULL
    RETURNING *;
  `;

  return result;
};

export {
  createMessage,
  getConversationMessages,
  getUserConversations,
  markMessageAsRead,
  markConversationAsRead
};

