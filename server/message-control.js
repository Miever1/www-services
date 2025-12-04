import * as messageService from "./message-service.js";

// Send a new message
const sendMessage = async (c) => {
  try {
    const body = await c.req.json();
    const userId = c.user?.id;

    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { task_id, receiver_id, content } = body;

    if (!task_id || !receiver_id || !content) {
      return c.json({ error: 'Missing required fields: task_id, receiver_id, content' }, 400);
    }

    const message = await messageService.createMessage(task_id, userId, receiver_id, content);
    return c.json(message, 201);
  } catch (error) {
    console.error('Error sending message:', error);
    return c.json({ error: 'Failed to send message', message: error.message }, 500);
  }
};

// Get conversation messages between two users for a specific task
const getConversationMessages = async (c) => {
  try {
    const userId = c.user?.id;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('taskId');
    const otherUserId = c.req.query('otherUserId');

    if (!taskId || !otherUserId) {
      return c.json({ error: 'Missing required parameters: taskId, otherUserId' }, 400);
    }

    const messages = await messageService.getConversationMessages(taskId, userId, otherUserId);
    
    // Mark messages as read
    await messageService.markConversationAsRead(taskId, userId, otherUserId);

    return c.json(messages, 200);
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    return c.json({ error: 'Failed to get messages', message: error.message }, 500);
  }
};

// Get all conversations for the current user
const getUserConversations = async (c) => {
  try {
    const userId = c.user?.id;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const conversations = await messageService.getUserConversations(userId);
    return c.json(conversations, 200);
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return c.json({ error: 'Failed to get conversations', message: error.message }, 500);
  }
};

// Get or create a conversation for a specific task
const getOrCreateConversation = async (c) => {
  try {
    const userId = c.user?.id;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const taskId = c.req.param('taskId');
    const otherUserId = c.req.query('otherUserId');

    if (!taskId || !otherUserId) {
      return c.json({ error: 'Missing required parameters: taskId, otherUserId' }, 400);
    }

    // Get existing messages/conversation
    const messages = await messageService.getConversationMessages(taskId, userId, otherUserId);
    return c.json({ messages, taskId, otherUserId }, 200);
  } catch (error) {
    console.error('Error getting conversation:', error);
    return c.json({ error: 'Failed to get conversation', message: error.message }, 500);
  }
};

export {
  sendMessage,
  getConversationMessages,
  getUserConversations,
  getOrCreateConversation
};

