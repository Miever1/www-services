//import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import * as taskService from "./task-service.js";

//const eta = new Eta({ views: `${Deno.cwd()}/templates/` });

//Pass task as JSON file
const createTask = async (c) => {
  const body = await c.req.json();
  
  // Get userId from context (set by middleware) or from request body
  const userId = c.user?.id || body.userId || '00000000-0000-0000-0000-000000000000';
  
  const result = await taskService.createTask(userId, body);
  return c.json(result, 201);
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