import postgres from "postgres";
/*
const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString);
*/

const sql = postgres();

//Create a new task
const createTask = async (userID, task) => {
  const id = crypto.randomUUID();
  
  const { name, description, location, price, type, category, images } = task;
  
  // Validate and convert userID to UUID format
  // If userID is not a valid UUID, generate one or use a default
  let userIdUuid = userID;
  try {
    // Try to validate if it's a valid UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userID)) {
      // Not a valid UUID, generate a new one or use a default anonymous UUID
      userIdUuid = '00000000-0000-0000-0000-000000000000'; // Anonymous user UUID
    }
  } catch (e) {
    userIdUuid = '00000000-0000-0000-0000-000000000000';
  }
  
  const taskType = type || 'need';
  const taskPrice = price ? parseFloat(price) : 0;
  const taskLocation = location || 'Espoo, Finland';
  
  // Handle images - convert to JSONB array format
  const imagesArray = images ? (Array.isArray(images) ? images : [images]) : [];
  
  const result = await sql`
    INSERT INTO tasks (id, name, description, user_id, location, price, type, category, images)
    VALUES (${id}, ${name}, ${description}, ${userIdUuid}::uuid, ${taskLocation}, ${taskPrice}, ${taskType}::task_type, ${category || null}, ${JSON.stringify(imagesArray)}::jsonb)
    RETURNING *;
  `;

  const createdTask = result[0];
  // Parse JSONB images field if it exists
  if (createdTask.images) {
    try {
      createdTask.images = typeof createdTask.images === 'string' ? JSON.parse(createdTask.images) : createdTask.images;
    } catch (e) {
      console.error('Error parsing images:', e);
      createdTask.images = [];
    }
  } else {
    createdTask.images = [];
  }
  
  console.log(createdTask);
  return createdTask;
}

//Get task with id
const readTask = async (id) => {
  const result = await sql`
    SELECT * FROM tasks WHERE id=${id};
  `;

  if(result.length === 0) {
    return null;
  }
  
  const task = result[0];
  // Parse JSONB images field if it exists
  if (task.images) {
    try {
      task.images = typeof task.images === 'string' ? JSON.parse(task.images) : task.images;
    } catch (e) {
      console.error('Error parsing images:', e);
      task.images = [];
    }
  } else {
    task.images = [];
  }
  
  return task;
}

//Update a task of a given ID
const updateTask = async (id, task) => {
  const { name, description, location, price, type, images } = task;
  
  const taskType = type || 'need';
  const taskPrice = price ? parseFloat(price) : 0;
  const taskLocation = location || 'Espoo, Finland';
  
  // Handle images if provided
  const imagesArray = images !== undefined ? (Array.isArray(images) ? images : [images]) : null;

  let result;
  if (imagesArray !== null) {
    result = await sql`
      UPDATE tasks
      SET name=${name}, description=${description}, location=${taskLocation}, price=${taskPrice}, type=${taskType}::task_type, images=${JSON.stringify(imagesArray)}::jsonb, time=CURRENT_TIMESTAMP
      WHERE id=${id}
      RETURNING *;
    `;
  } else {
    result = await sql`
      UPDATE tasks
      SET name=${name}, description=${description}, location=${taskLocation}, price=${taskPrice}, type=${taskType}::task_type, time=CURRENT_TIMESTAMP
      WHERE id=${id}
      RETURNING *;
    `;
  }

  return result[0];
}

//Delete a task 
const deleteTask = async (id) => {
  const result = await sql`DELETE FROM tasks WHERE id=${id} RETURNING *;`;

  console.log(result);
}

const listAllTasks = async () => {
  const result = await sql`
    SELECT * FROM tasks
    ORDER BY time DESC;
  `;

  // Parse JSONB images field for each task
  return result.map(task => {
    if (task.images) {
      try {
        task.images = typeof task.images === 'string' ? JSON.parse(task.images) : task.images;
      } catch (e) {
        console.error('Error parsing images:', e);
        task.images = [];
      }
    } else {
      task.images = [];
    }
    return task;
  });
}

const markTaskAsComplete = async (id) => {
  const result = await sql `
    UPDATE tasks
    SET completed=${true}, time=CURRENT_TIMESTAMP
    WHERE id=${id}
  `;
}

const markTaskAsIncomplete = async (id) => {
  const result = await sql `
    UPDATE tasks
    SET completed=${false}, time=CURRENT_TIMESTAMP
    WHERE id=${id}
  `;
}

export { createTask, readTask, updateTask, deleteTask, listAllTasks, markTaskAsComplete, markTaskAsIncomplete }