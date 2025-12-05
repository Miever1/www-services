//import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import * as taskService from "./task-service.js";

//const eta = new Eta({ views: `${Deno.cwd()}/templates/` });

//Pass task as JSON file
const createTask = async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return c.json({ error: 'Invalid request body. Expected JSON format.' }, 400);
    }
    
    // Log request size for debugging
    const requestSize = JSON.stringify(body).length;
    console.log(`Create task: Request size: ${requestSize} bytes`);
    
    // Check if images are too large
    if (body.images && Array.isArray(body.images)) {
      const totalImageSize = body.images.reduce((sum, img) => {
        if (typeof img === 'string') return sum + img.length;
        if (img && img.data) return sum + img.data.length;
        if (img && typeof img === 'object') return sum + JSON.stringify(img).length;
        return sum;
      }, 0);
      console.log(`Create task: Total images size: ${totalImageSize} bytes, Image count: ${body.images.length}`);
      
      // Limit to 6 images and warn if too large
      if (body.images.length > 6) {
        console.warn(`Create task: Too many images (${body.images.length}), limiting to 6`);
        body.images = body.images.slice(0, 6);
      }
      
      if (totalImageSize > 10000000) { // 10MB
        console.warn(`Create task: Images too large (${totalImageSize} bytes), this may cause issues`);
      }
    }
    
    // Get userId from context (set by middleware) or from request body
    const userId = c.user?.id || body.userId || '00000000-0000-0000-0000-000000000000';
    
    console.log(`Create task: Creating task for user ${userId}, name: ${body.name}`);
    
    // 📸 Debug: Log images data before saving
    if (body.images) {
      console.log(`📸 Create task: Images received - count: ${Array.isArray(body.images) ? body.images.length : 1}, first image length: ${Array.isArray(body.images) && body.images[0] ? body.images[0].length : 0}`);
    } else {
      console.log(`⚠️ Create task: No images in request body`);
    }
    
    const result = await taskService.createTask(userId, body);
    
    console.log(`Create task: Task created successfully with ID: ${result.id}`);
    
    // 📸 Debug: Log images data after saving
    if (result.images) {
      console.log(`📸 Create task: Images saved - count: ${Array.isArray(result.images) ? result.images.length : 1}`);
    } else {
      console.log(`⚠️ Create task: No images in saved task`);
    }
    
    return c.json(result, 201);
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error stack:', error.stack);
    return c.json({ 
      error: 'Failed to create task', 
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, 500);
  }
}

const showTask = async (c) => {
  const id = c.req.param('id');

  try {
    const result = await taskService.readTask(id);
    if(!result) {
      return c.json({ message: "task not found" }, 404);
    }
    
    // Log response size for debugging
    const responseSize = JSON.stringify(result).length;
    if (result.images && Array.isArray(result.images) && result.images.length > 0) {
      const totalImageSize = result.images.reduce((sum, img) => {
        if (typeof img === 'string') return sum + img.length;
        if (img && img.data) return sum + img.data.length;
        return sum;
      }, 0);
      console.log(`Show task ${id}: Response size: ${responseSize} bytes, Images total: ${totalImageSize} bytes`);
    }
    
    return c.json(result, 200);
  } catch (error) {
    console.error(`Error showing task ${id}:`, error);
    return c.json({ error: 'Failed to get task', message: error.message }, 500);
  }
}

const updateTask = async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const result = await taskService.updateTask(id, body);
  return c.json(result, 201);
}

const deleteTask = async (c) => {
  const id = c.req.param('id');
  
  await taskService.deleteTask(id);
  return c.json({ message: "task deleted" }, 200);
}

const listAllTasks = async (c) => {
  try {
    const result = await taskService.listAllTasks();

    // Calculate response size for logging
    const responseSize = JSON.stringify(result).length;
    console.log(`List tasks: Returning ${result.length} tasks, response size: ${responseSize} bytes`);

    // For list view, only return first image to reduce response size
    // Full images will be loaded when viewing individual task details
    const optimizedResult = result.map(task => {
      if (task.images && Array.isArray(task.images) && task.images.length > 0) {
        // Only return first image for list view
        return { ...task, images: [task.images[0]] };
      }
      return task;
    });

    const optimizedSize = JSON.stringify(optimizedResult).length;
    console.log(`List tasks: Optimized response size: ${optimizedSize} bytes`);

    return c.json(optimizedResult, 200);
  } catch (error) {
    console.error('Error listing tasks:', error);
    return c.json({ error: 'Failed to list tasks', message: error.message }, 500);
  }
}

const markTaskAsComplete = async(c) => {
  const id = c.req.param('id');

  await taskService.markTaskAsComplete(id);
  return c.json({ message: "task completed" }, 200);
}

const markTaskAsIncomplete = async(c) => {
  const id = c.req.param('id');

  await taskService.markTaskAsIncomplete(id);
  return c.json({ message: "task not complete" }, 200);
}

export { createTask, showTask, updateTask, deleteTask, listAllTasks, markTaskAsComplete, markTaskAsIncomplete }