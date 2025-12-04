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

  const result = await taskService.readTask(id)
  if(!result) {
    return c.json({ message: "task not found" }, 404);
  }
  return c.json(result, 200);
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
  const result = await taskService.listAllTasks();

  return c.json(result, 200);
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