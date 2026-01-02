// ========================
// CONFIGURATION
// ========================
const SHEET_ID = "1g3SBNnN_S2Vn_VfngvZ4DfKPDt1LnTVAa0u5lWjQhGs"; // <-- Your Google Sheet ID
const SECRET_KEY = "yoyo";
const ADMIN_PIN = "9999"; // Master admin PIN

// ========================
// API ENTRY POINT
// ========================
function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST'
  };

  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, data, secret } = payload;

    // Verify secret
    if (secret !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        error: "Unauthorized"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);

    let result;
    switch(action) {
      case "LOGIN": 
        result = handleLogin(ss, data);
        break;
      case "GET_ITEMS": 
        result = getItems(ss);
        break;
      case "SEARCH_ITEMS": 
        result = searchItems(ss, data.query);
        break;
      case "ADD_ITEM": 
        result = addItem(ss, data);
        break;
      case "UPDATE_ITEM": 
        result = updateItem(ss, data);
        break;
      case "DELETE_ITEM": 
        result = deleteItem(ss, data);
        break;
      case "DEDUCT_ITEM": 
        result = deductItem(ss, data);
        break;
      case "RESTOCK_ITEM": 
        result = restockItem(ss, data);
        break;
      case "GET_EMPLOYEES": 
        result = getEmployees(ss);
        break;
      case "ADD_EMPLOYEE": 
        result = addEmployee(ss, data);
        break;
      case "UPDATE_EMPLOYEE": 
        result = updateEmployee(ss, data);
        break;
      case "DELETE_EMPLOYEE": 
        result = deleteEmployee(ss, data);
        break;
      case "GET_HISTORY": 
        result = getHistory(ss, data);
        break;
      case "UPDATE_HISTORY": 
        result = updateHistory(ss, data);
        break;
      case "DELETE_HISTORY": 
        result = deleteHistory(ss, data);
        break;
      case "ADD_TASK": 
        result = addTask(ss, data);
        break;
      case "GET_TASKS": 
        result = getTasks(ss, data.employeeId);
        break;
      // Add this to your switch case in doPost
      case "UPDATE_TASK_READ_STATUS":
        result = updateTaskReadStatus(ss, data);
        break;
      case "UPDATE_TASK_CHECK_STATUS":
        result = updateTaskCheckStatus(ss, data);
        break;
      case "REGISTER_PUSH_TOKEN":
        result = registerPushToken(ss, data);
        break;
      case "UPDATE_TASK":
        result = updateTask(ss, data);
        break;
      case "DELETE_TASK":
        result = deleteTask(ss, data);
        break;
      case "UPDATE_LOW_STOCK_THRESHOLD":
        result = updateLowStockThreshold(ss, data.threshold);
        break;
      case "GET_LOW_STOCK_THRESHOLD":
        result = getLowStockThreshold(ss);
        break;
      default: 
        throw new Error("Invalid action");
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type"
    });
}

function getLowStockThreshold(ss) {
  const settingsSheet = ss.getSheetByName("Settings");
  if (!settingsSheet) {
    return { threshold: 1 };
  }

  const data = settingsSheet.getDataRange().getValues();
  const thresholdRow = data.find(row => row[0] === "low_stock_threshold");
  
  return {
    threshold: thresholdRow && !isNaN(parseInt(thresholdRow[1])) 
      ? parseInt(thresholdRow[1]) 
      : 1
  };
}

function updateLowStockThreshold(ss, threshold) {
  const settingsSheet = ss.getSheetByName("Settings") || ss.insertSheet("Settings");
  
  // Set header if empty
  const lastRow = settingsSheet.getLastRow();
  if (lastRow === 0) {
    settingsSheet.getRange(1, 1).setValue("Setting");
    settingsSheet.getRange(1, 2).setValue("Value");
  }

  // Find existing threshold row
  const data = settingsSheet.getDataRange().getValues();
  const thresholdRow = data.findIndex(row => row[0] === "low_stock_threshold");

  if (thresholdRow !== -1) {
    settingsSheet.getRange(thresholdRow + 1, 2).setValue(parseInt(threshold));
  } else {
    settingsSheet.appendRow(["low_stock_threshold", parseInt(threshold)]);
  }

  return { success: true };
}

function sendEmail(to, subject, body) {
  const options = {
    from: "arkadestore88@gmail.com", // Replace with your sender email
    name: "Task Management System"
  };
  
  try {
    MailApp.sendEmail(to, subject, body, options);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

function registerPushToken(ss, { employeeId, token }) {
  const sheet = ss.getSheetByName("Employees");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("id");
  const tokenCol = headers.indexOf("expo_push_token");

  if (idCol === -1 || tokenCol === -1) {
    throw new Error("Missing required columns: 'id' or 'expo_push_token'");
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === employeeId) {
      sheet.getRange(i + 1, tokenCol + 1).setValue(token);
      return { success: true };
    }
  }

  return { success: false, message: "Employee ID not found" };
}

function getRegisteredPushTokens(ss) {
  const data = getSheetData(ss, "Employees");
  return data
    .map(row => row.expo_push_token)
    .filter(token => token); // remove empty tokens
}

function updateTaskReadStatus(ss, { taskId, employeeId }) {
  const sheet = ss.getSheetByName("Tasks");
  const tasks = getSheetData(ss, "Tasks");
  const taskIndex = tasks.findIndex(t => t.task_id === taskId);
  
  if (taskIndex === -1) return;
  
  const row = taskIndex + 2; // +2 for header + 1-based index
  const readBy = tasks[taskIndex].read_by || "";
  
  if (!readBy.includes(employeeId)) {
    const updatedReadBy = readBy ? `${readBy},${employeeId}` : employeeId;
    sheet.getRange(row, 8).setValue(updatedReadBy); // Assuming column H
  }
}

function updateTaskCheckStatus(ss, { taskId, employeeId }) {
  const sheet = ss.getSheetByName("Tasks");
  const tasks = getSheetData(ss, "Tasks");
  const taskIndex = tasks.findIndex(t => t.task_id === taskId);
  
  if (taskIndex === -1) return;
  
  const row = taskIndex + 2; // +2 for header + 1-based index
  const readBy = tasks[taskIndex].checked_by || "";
  
  if (!readBy.includes(employeeId)) {
    const updatedReadBy = readBy ? `${readBy},${employeeId}` : employeeId;
    sheet.getRange(row, 9).setValue(updatedReadBy); // Assuming column I
  }
}

// Add these new functions to your backend
function updateTask(ss, { task_id, title, description, item, status }) {
  const tasksSheet = ss.getSheetByName("Tasks");
  const tasks = getSheetData(ss, "Tasks");
  const taskIndex = tasks.findIndex(t => t.task_id === task_id);
  
  if (taskIndex === -1) throw new Error("Task not found");
  
  const row = taskIndex + 2; // +2 for header row and 1-based index
  
  tasksSheet.getRange(row, 2).setValue(title); // Title (column B)
  tasksSheet.getRange(row, 3).setValue(description || ""); // Description (column C)
  tasksSheet.getRange(row, 4).setValue(JSON.stringify(item || [])); // Items (column D)
  tasksSheet.getRange(row, 7).setValue(new Date()); // Updated at (column G)
  tasksSheet.getRange(row, 6).setValue(status);

  // Get all employee IDs to notify (skip admins/dummies)
  const employeeIds = allEmployees
    .filter(emp => emp.role === "employee" && emp.expo_push_token && emp.expo_push_token.startsWith("ExponentPushToken["))
    .map(emp => emp.id);

  allEmployees
    .filter(emp => employeeIds.includes(emp.id))
    .forEach(emp => {
      sendExpoNotification(ss,{
        to: emp.expo_push_token,
        title: "Incoming Update Call",
        body: description || "Update task assignment",
        data: JSON.stringify({
          taskId: newId,
          type: 'fake_call',
          taskTitle: title,
          taskDescription: description || "",
          employeeId: emp.id
        }),
        priority: 'high',     // Critical for background sound
        channelId: 'calls',   // Android-specific channel
        sound: 'ringtone',    // Ensures sound plays
        _displayInForeground: true
      });
    });

  // Schedule repeated notification (non-blocking)
  scheduleTaskNotificationLoop(newId, employeeIds, 60, 5);

  // Send email to all employees with valid email addresses
  const emailList = allEmployees
    .filter(emp => emp.email && emp.role !== "admin") // Only employees with email
    .map(emp => emp.email);   // Extract just the emails

  if (emailList.length > 0) {
    const emailContent = `
      <h2>New Task Created</h2>
      <p><strong>Task ID:</strong> ${newId}</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Description:</strong> ${description || "No description provided"}</p>
      <p><strong>Items:</strong> ${items.join(", ")}</p>
      <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
      <p>Please check the task management system for details.</p>
    `;
    
    try {
      MailApp.sendEmail({
        to: emailList.join(","), // Send to all at once
        subject: `New Task: ${title}`,
        htmlBody: emailContent,
        noReply: true // Prevents reply-to
      });
      console.log(`Email sent to ${emailList.length} employees`);
    } catch (error) {
      console.error("Failed to send group email:", error);
      
      // Fallback: Send individually if batch fails
      emailList.forEach(email => {
        try {
          MailApp.sendEmail(email, `New Task: ${title}`, "", {
            htmlBody: emailContent
          });
        } catch (individualError) {
          console.error(`Failed to send to ${email}:`, individualError);
        }
      });
    }
  }
  
  return { success: true };
}

function deleteTask(ss, { taskId }) {
  const tasksSheet = ss.getSheetByName("Tasks");
  const tasks = getSheetData(ss, "Tasks");
  const taskIndex = tasks.findIndex(t => t.task_id === taskId);
  
  if (taskIndex === -1) throw new Error("Task not found");
  
  tasksSheet.deleteRow(taskIndex + 2); // +2 for header row and 1-based index
  return { success: true };
}

// Modify your existing addTask function to insert at row 2
function addTask(ss, { title, description, items }) {
  const tasksSheet = ss.getSheetByName("Tasks");
  const employeesSheet = ss.getSheetByName("Employees");
  
  // Get existing data
  const tasks = getSheetData(ss, "Tasks");
  const allEmployees = getSheetData(ss, "Employees");
  
  // Generate new task ID (existing code)
  let maxId = 0;
  tasks.forEach(task => {
    if (task.task_id && task.task_id.startsWith("TASK")) {
      const idNum = parseInt(task.task_id.substring(4));
      if (!isNaN(idNum)) maxId = Math.max(maxId, idNum);
    }
  });
  const newId = `TASK${String(maxId + 1).padStart(5, '0')}`;
  
  // Insert new task (existing code)
  tasksSheet.insertRowBefore(2);
  tasksSheet.getRange(2, 1, 1, 8).setValues([[
    newId,
    title,
    description || "",
    JSON.stringify(items || []),
    new Date(),
    "assigned",
    "",
    ""
  ]]);

  // Get all employee IDs to notify (skip admins/dummies)
  const employeeIds = allEmployees
    .filter(emp => emp.role === "employee" && emp.expo_push_token && emp.expo_push_token.startsWith("ExponentPushToken["))
    .map(emp => emp.id);

  allEmployees
    .filter(emp => employeeIds.includes(emp.id))
    .forEach(emp => {
      sendExpoNotification(ss,{
        to: emp.expo_push_token,
        title: "Incoming Task Call",
        body: description || "New task assignment",
        data: JSON.stringify({
          taskId: newId,
          type: 'fake_call',
          taskTitle: title,
          taskDescription: description || "",
          employeeId: emp.id
        }),
        priority: 'high',     // Critical for background sound
        channelId: 'calls',   // Android-specific channel
        sound: 'ringtone',    // Ensures sound plays
        _displayInForeground: true
      });
    });

  // Schedule repeated notification (non-blocking)
  scheduleTaskNotificationLoop(newId, employeeIds, 60, 5);

  // Send email to all employees with valid email addresses
  const emailList = allEmployees
    .filter(emp => emp.email && emp.role !== "admin") // Only employees with email
    .map(emp => emp.email);   // Extract just the emails

  if (emailList.length > 0) {
    const emailContent = `
      <h2>New Task Created</h2>
      <p><strong>Task ID:</strong> ${newId}</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Description:</strong> ${description || "No description provided"}</p>
      <p><strong>Items:</strong> ${items.join(", ")}</p>
      <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
      <p>Please check the task management system for details.</p>
    `;
    
    try {
      MailApp.sendEmail({
        to: emailList.join(","), // Send to all at once
        subject: `New Task: ${title}`,
        htmlBody: emailContent,
        noReply: true // Prevents reply-to
      });
      console.log(`Email sent to ${emailList.length} employees`);
    } catch (error) {
      console.error("Failed to send group email:", error);
      
      // Fallback: Send individually if batch fails
      emailList.forEach(email => {
        try {
          MailApp.sendEmail(email, `New Task: ${title}`, "", {
            htmlBody: emailContent
          });
        } catch (individualError) {
          console.error(`Failed to send to ${email}:`, individualError);
        }
      });
    }
  }

  return { task_id: newId };
}

// Helper function to send Expo notifications
function sendExpoNotification(ss, messagePayload) {
  const employees = getSheetData(ss, "Employees");

  const recipients = employees.filter(emp => 
    emp.expo_push_token && emp.expo_push_token.startsWith("ExponentPushToken[")
  );

  if (recipients.length === 0) {
    console.log("No valid push tokens found");
    return;
  }

  // const messages = recipients.map(emp => ({
  //   to: emp.expo_push_token,
  //   ...messagePayload
  // }));
  const messages = { ...messagePayload };

  try {
    var response = UrlFetchApp.fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(messagePayload),
      muteHttpExceptions: true
    });
    var result = JSON.parse(response.getContentText());
    console.log('Notification sent:', result);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}


function getTasks(ss, employeeId) {
  const tasks = getSheetData(ss, "Tasks");
  const history = getSheetData(ss, "History");

  return tasks.map(task => {
    // Safely parse items
    let taskItems = [];
    try {
      taskItems = JSON.parse(task.items || "[]");
    } catch (e) {
      taskItems = [];
      console.error("Failed to parse task items:", e);
    }

    // Parse assigned_at into a Date object for comparison
    const assignedAt = new Date(task.assigned_at);

    return {
      ...task,
      // status: isCompleted ? "completed" : task.status,
      status: task.status,
      items: taskItems,
      items_count: taskItems.length,
      read_by_list: task.read_by?.split(",") || [],
      read_by_count: task.read_by?.split(",").length || 0,
      checked_by_list: task.checked_by?.split(",") || [],
      checked_by_count: task.checked_by?.split(",").length || 0
    };
  }).filter(task => {
    return !employeeId || task.status !== "completed";
  });
}

// ========================
// AUTHENTICATION
// ========================
// For web-admin: login by PIN only (admin or employee)
// For mobile: login by name + PIN (employee only)
function handleLogin(ss, data) {
  const employees = getSheetData(ss, "Employees");
  
  // Web-admin: require email + password
  if (data.email && data.password) {
    const hash = hashPin(data.password); // Uses same SHA-256 hash as PIN
    const employee = employees.find(e =>
      e.email?.toLowerCase().trim() === data.email.toLowerCase().trim() &&
      e.pin_hash === hash &&
      e.role === "admin"
    );

    if (!employee) throw new Error("Invalid email or password");

    // Update last login
    const empSheet = ss.getSheetByName("Employees");
    const rowIndex = employees.findIndex(e => e.id === employee.id) + 2;
    empSheet.getRange(rowIndex, 5).setValue(new Date()); // Assuming column 5 = last_login

    return {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      email: employee.email
    };
  }

  // Optional fallback for mobile (name + pin)
  if (data.name && data.pin) {
    const hash = hashPin(data.pin);
    const employee = employees.find(e =>
      String(e.name).toLowerCase().trim() === String(data.name).toLowerCase().trim() &&
      e.pin_hash === hash
    );
    if (!employee) throw new Error("Invalid name or PIN");

    const empSheet = ss.getSheetByName("Employees");
    const rowIndex = employees.findIndex(e =>
      String(e.name).toLowerCase().trim() === String(data.name).toLowerCase().trim()
    ) + 2;
    empSheet.getRange(rowIndex, 5).setValue(new Date());

    return {
      id: employee.id,
      name: employee.name,
      role: employee.role
    };
  }

  throw new Error("Invalid login parameters");
}

function hashPin(pin) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin);
  return Utilities.base64Encode(hash);
}

// ========================
// ITEM MANAGEMENT
// ========================
function getItems(ss) {
  return getSheetData(ss, "Items");
}

function searchItems(ss, query) {
  const items = getSheetData(ss, "Items");
  const results = items.filter(item => 
    (item.name || "").toLowerCase().includes(query.toLowerCase()) ||
    (item.category || "").toLowerCase().includes(query.toLowerCase())
  );
  return results;
}

function addItem(ss, data) {
  const sheet = ss.getSheetByName("Items");
  const items = getSheetData(ss, "Items");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Generate new ID
  const lastId = items.length > 0
    ? Math.max(...items.map(e => parseInt((e.id || "0").replace("ITM", ""))))
    : 0;
  const newId = `ITM${String(lastId + 1).padStart(5, '0')}`;
  const now = new Date();

  // Prepare row data in the correct order
  const row = headers.map(header => {
    const key = header.toLowerCase();
    if (key === 'id') return newId;
    if (key === 'created_at' || key === 'updated_at') return now;
    return data[key] || "";
  });
  sheet.appendRow(row);

  return {
    id: newId,
    ...data,
    created_at: now,
    updated_at: now
  };
}

function updateItem(ss, itemData) {
  const itemsSheet = ss.getSheetByName("Items");
  const items = getSheetData(ss, "Items");
  const headers = itemsSheet.getRange(1, 1, 1, itemsSheet.getLastColumn()).getValues()[0];

  const itemIndex = items.findIndex(i => i.id === itemData.id);
  if (itemIndex === -1) throw new Error("Item not found");

  const row = itemIndex + 2; // +2 because header row is 1 and array index starts at 0

  // Get current stock column
  const currentStockCol = headers.findIndex(h => h.toLowerCase() === "stock") + 1;
  const oldStock = Number(itemsSheet.getRange(row, currentStockCol).getValue());
  const newStock = Number(itemData.stock);

  // Remove stock from update loop to prevent direct update
  const stockValue = itemData.stock;
  delete itemData.stock;

  // Update other properties
  Object.keys(itemData).forEach(key => {
    const colIndex = headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
    if (colIndex !== -1 && key !== "id") {
      itemsSheet.getRange(row, colIndex + 1).setValue(itemData[key]);
    }
  });

  // Handle stock changes
  if (!isNaN(oldStock) && !isNaN(newStock)) {
    if (newStock < oldStock) {
      // Stock decreased - use deductItem
      const deductQty = oldStock - newStock;
      deductItem(ss, {
        employeeId: "ADMIN",
        employeeName: "Administrator",
        items: [{ itemId: itemData.id, qty: deductQty }]
      });
    } else if (newStock > oldStock) {
      // Stock increased - update directly and record restock
      const restockQty = newStock - oldStock;
      itemsSheet.getRange(row, currentStockCol).setValue(newStock);
      recordHistory(ss, {
        employeeId: "ADMIN",
        employeeName: "Administrator",
        itemId: itemData.id,
        itemName: items[itemIndex].name,
        qty: restockQty,
        action: "restock"
      });
    }
    // If equal, no change needed
  }

  // Update updated_at timestamp
  const updatedAtCol = headers.findIndex(h => h.toLowerCase() === "updated_at");
  if (updatedAtCol !== -1) {
    itemsSheet.getRange(row, updatedAtCol + 1).setValue(new Date());
  }

  // Restore stock value in returned data
  return { 
    ...itemData, 
    stock: stockValue,
    updated_at: new Date() 
  };
}

function deleteItem(ss, { id }) {
  const itemsSheet = ss.getSheetByName("Items");
  const items = getSheetData(ss, "Items");
  const itemIndex = items.findIndex(i => i.id === id);
  if (itemIndex === -1) throw new Error("Item not found");

  itemsSheet.deleteRow(itemIndex + 2);
  return { id };
}

// ========================
// DEDUCT/RESTOCK ITEMS
// ========================
// Accepts both single and multiple item deduction
function deductItem(ss, data) {
  const itemsSheet = ss.getSheetByName("Items");
  const historySheet = ss.getSheetByName("History");
  const tasksSheet = ss.getSheetByName("Tasks");
  const employeesSheet = ss.getSheetByName("Employees");

  const items = getSheetData(ss, "Items");
  const tasks = getSheetData(ss, "Tasks");
  const employees = getSheetData(ss, "Employees");

  const activeTasks = tasks
    .filter(task => task.status === "assigned")
    .sort((a, b) => new Date(a.assigned_at) - new Date(b.assigned_at));

  const adminEmails = employees
    .filter(emp => emp.role === "admin")
    .map(emp => emp.email);

  const lowStockThreshold = getLowStockThreshold(ss).threshold;
  const lowStockAlerts = []; // Collect items below threshold

  // Process each item deduction
  data.items.forEach(({ itemId, qty }) => {
    const itemRow = items.findIndex(i => i.id === itemId) + 2;
    const currentStock = Number(itemsSheet.getRange(itemRow, 4).getValue());
    
    // Deduct stock
    const newStock = Math.max(currentStock - qty, 0);
    itemsSheet.getRange(itemRow, 4).setValue(newStock);
    itemsSheet.getRange(itemRow, 8).setValue(new Date()); // updated_at

    // Record history
    historySheet.insertRowBefore(2);
    historySheet.getRange(2, 1, 1, 9).setValues([[
      Utilities.getUuid(),
      new Date(),
      data.employeeId,
      data.employeeName,
      itemId,
      items.find(i => i.id === itemId)?.name || "Unknown Item",
      qty,
      "deduct",
      ""
    ]]);

    // Check if stock fell below threshold
    if (newStock <= lowStockThreshold) {
      lowStockAlerts.push({
        name: items.find(i => i.id === itemId)?.name || "Unknown Item",
        id: itemId,
        stock: newStock
      });
    }

    // Distribute deduction across tasks (existing logic)
    let remainingQty = qty;
    for (const task of activeTasks) {
      if (remainingQty <= 0) break;
      try {
        const taskItems = JSON.parse(task.items || "[]");
        const taskItem = taskItems.find(i => i.item_id === itemId && i.required_qty > 0);
        if (!taskItem) continue;

        const deductAmount = Math.min(remainingQty, taskItem.required_qty);
        taskItem.required_qty -= deductAmount;
        remainingQty -= deductAmount;

        const taskRow = taskRowMap.get(task.task_id);
        if (taskRow) {
          tasksSheet.getRange(taskRow, 4).setValue(JSON.stringify(taskItems));
        }
      } catch (e) {
        console.error(`Error processing task ${task.task_id}:`, e);
      }
    }
  });

  // Send alert email to admins if any items are low on stock
  if (lowStockAlerts.length > 0 && adminEmails.length > 0) {
    const emailContent = `
      <h2>Low Stock Alert</h2>
      <p>The following items are now below the low stock threshold:</p>
      <ul style="list-style: none; padding-left: 0;">
        ${lowStockAlerts.map(item => `
          <li style="margin-bottom: 8px;">
            <strong>${item.name}</strong> (ID: ${item.id}) - Current Stock: ${item.stock}
          </li>
        `).join("")}
      </ul>
      <p>Threshold: ${lowStockThreshold}</p>
      <p>Please restock as soon as possible.</p>
    `;

    try {
      MailApp.sendEmail({
        to: adminEmails.join(","),
        subject: `⚠️ Low Stock Alert - ${lowStockAlerts.length} Item(s) Below Threshold`,
        htmlBody: emailContent
      });
      console.log(`Sent low stock alert to ${adminEmails.length} admins`);
    } catch (error) {
      console.error("Failed to send low stock email:", error);
    }
  }

  return { success: true };
}

// NEW HELPER FUNCTION - Handles all date formats in your sheet
function parseAnyDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  
  // Try ISO format (2025-06-15 1:20:19)
  let date = new Date(dateStr);
  if (!isNaN(date)) return date;
  
  // Try DD/MM/YYYY format (15/06/2025 1:20:19)
  const parts = dateStr.split(' ');
  if (parts[0].includes('/')) {
    const [day, month, year] = parts[0].split('/');
    date = new Date(`${month}/${day}/${year} ${parts[1] || ''}`);
    if (!isNaN(date)) return date;
  }
  
  // Fallback to epoch if parsing fails
  return new Date(0);
}

// ========================
// HISTORY MANAGEMENT
// ========================
function getHistory(ss, { employeeId, limit = 50, startDate, endDate }) {
  const history = getSheetData(ss, "History");

  // Apply filters
  let filtered = history;

  if (employeeId) {
    filtered = filtered.filter(h => h.employee_id === employeeId);
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // Include entire end date
    
    filtered = filtered.filter(h => {
      try {
        const recordDate = new Date(h.timestamp);
        return recordDate >= start && recordDate <= end;
      } catch (e) {
        return false; // Skip invalid date formats
      }
    });
  }

  // Return newest first (reverse chronological order)
  return filtered.slice(0, limit);
}

function recordHistory(ss, { employeeId, employeeName, itemId, itemName, qty, action }) {
  const historySheet = ss.getSheetByName("History");
  const historyId = Utilities.getUuid();
  
  // Insert new row at position 2 (right below header)
  historySheet.insertRowBefore(2);
  
  // Set values in the new row 2
  historySheet.getRange(2, 1, 1, 9).setValues([
    [
      historyId,
      new Date(),
      employeeId,
      employeeName,
      itemId,
      itemName,
      qty,
      action,
      "" // admin_note (empty by default)
    ]
  ]);
  
  return historyId;
}


function updateHistory(ss, { id, qty, action }) {
  const historySheet = ss.getSheetByName("History");
  const history = getSheetData(ss, "History");

  const recordIndex = history.findIndex(h => h.id === id);
  if (recordIndex === -1) throw new Error("History record not found");

  const row = recordIndex + 2; // +2 for header row and 1-based index
  const headers = historySheet.getRange(1, 1, 1, historySheet.getLastColumn()).getValues()[0];

  if (qty !== undefined) {
    const qtyCol = headers.findIndex(h => h.toLowerCase() === "qty") + 1;
    if (qtyCol > 0) historySheet.getRange(row, qtyCol).setValue(qty);
  }

  if (action) {
    const actionCol = headers.findIndex(h => h.toLowerCase() === "action") + 1;
    if (actionCol > 0) historySheet.getRange(row, actionCol).setValue(action);
  }

  return { success: true, message: "History updated" };
}

function deleteHistory(ss, { id }) {
  const historySheet = ss.getSheetByName("History");
  const history = getSheetData(ss, "History");

  const recordIndex = history.findIndex(h => h.id === id);
  if (recordIndex === -1) throw new Error("History record not found");

  historySheet.deleteRow(recordIndex + 2); // +2 for header row and 1-based index

  return { success: true, message: "History record deleted" };
}

// ========================
// EMPLOYEE MANAGEMENT
// ========================
function getEmployees(ss) {
  const employees = getSheetData(ss, "Employees");
  return employees.map(e => ({
    id: e.id,
    name: e.name,
    role: e.role,
    email: e.email,
    last_login: e.last_login
  }));
}

function addEmployee(ss, { name, pin, role = "employee", email }) {
  const sheet = ss.getSheetByName("Employees");
  const employees = getSheetData(ss, "Employees");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Generate ID
  const lastId = employees.length > 0 
    ? Math.max(...employees.map(e => parseInt((e.id || "0").replace("EMP", "")))) 
    : 0;
  const newId = `EMP${String(lastId + 1).padStart(5, '0')}`;

  // Hash PIN
  const hashStr = hashPin(pin);

  // Prepare row data in the correct order
  const row = headers.map(header => {
    const key = header.toLowerCase();
    if (key === 'id') return newId;
    if (key === 'name') return name;
    if (key === 'pin_hash') return hashStr;
    if (key === 'role') return role;
    if (key === 'email') return email;  // Add email
    if (key === 'last_login') return "";
    return "";
  });

  sheet.appendRow(row);

  return { id: newId };
}

function updateEmployee(ss, employeeData) {
  const employeesSheet = ss.getSheetByName("Employees");
  const employees = getSheetData(ss, "Employees");
  const headers = employeesSheet.getRange(1, 1, 1, employeesSheet.getLastColumn()).getValues()[0];

  const empIndex = employees.findIndex(e => e.id === employeeData.id);
  if (empIndex === -1) throw new Error("Employee not found");
  const row = empIndex + 2;

  Object.keys(employeeData).forEach(key => {
    if (key === "password" && employeeData.password) {
      const pinColIndex = headers.findIndex(h => h.toLowerCase() === "pin_hash");
      if (pinColIndex !== -1) {
        const hashStr = hashPin(employeeData.password);
        employeesSheet.getRange(row, pinColIndex + 1).setValue(hashStr);
      }
    } else {
      const colIndex = headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
      if (colIndex !== -1 && key !== "id") {
        employeesSheet.getRange(row, colIndex + 1).setValue(employeeData[key]);
      }
    }
  });

  return { ...employeeData };
}

function deleteEmployee(ss, { id }) {
  const employeesSheet = ss.getSheetByName("Employees");
  const employees = getSheetData(ss, "Employees");
  const empIndex = employees.findIndex(e => e.id === id);
  if (empIndex === -1) throw new Error("Employee not found");

  employeesSheet.deleteRow(empIndex + 2);
  return { id };
}

// ========================
// HELPER FUNCTIONS
// ========================
function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  const [headers, ...data] = sheet.getDataRange().getValues();
  
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      const key = header.toLowerCase().replace(/\s+/g, '_');
      // Preserve Date objects
      obj[key] = row[index] instanceof Date ? row[index] : row[index];
    });
    return obj;
  });
}

/**
 * Schedules repeated notifications for a task using a time-driven trigger.
 * @param {string} taskId - The task to notify about.
 * @param {string[]} employeeIds - Employees to notify.
 * @param {number} intervalSeconds - How often to notify (default 30).
 * @param {number} maxAttempts - How many times to notify (default 10).
 */
function scheduleTaskNotificationLoop(taskId, employeeIds, intervalSeconds, maxAttempts) {
  // Store state in Script Properties
  const props = PropertiesService.getScriptProperties();
  props.setProperty('notify_taskId', taskId);
  props.setProperty('notify_employeeIds', JSON.stringify(employeeIds));
  props.setProperty('notify_interval', intervalSeconds || 30);
  props.setProperty('notify_maxAttempts', maxAttempts || 10);
  props.setProperty('notify_attempt', 0);

  // Remove any old triggers for this function
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runTaskNotificationLoop') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create a new time-driven trigger (every 30 seconds)
  ScriptApp.newTrigger('runTaskNotificationLoop')
    .timeBased()
    .everyMinutes(1) // 0.5 minutes = 30 seconds
    .create();
}

/**
 * This function is called by the time-driven trigger.
 * It sends notifications and stops when all employees have read or maxAttempts is reached.
 */
function runTaskNotificationLoop() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const taskId = props.getProperty('notify_taskId');
  const employeeIds = JSON.parse(props.getProperty('notify_employeeIds') || '[]');
  const intervalSeconds = Number(props.getProperty('notify_interval') || 30);
  const maxAttempts = Number(props.getProperty('notify_maxAttempts') || 10);
  let attempt = Number(props.getProperty('notify_attempt') || 0);

  attempt++;
  props.setProperty('notify_attempt', attempt);

  const employees = getSheetData(ss, "Employees");
  const tasks = getSheetData(ss, "Tasks");
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) {
    cleanupTaskNotificationLoop();
    return;
  }

  const readByList = (task.read_by || "").split(",").map(s => s.trim());
  let allRead = true;

  employeeIds.forEach(empId => {
    if (!readByList.includes(empId)) {
      allRead = false;
      const employee = employees.find(e => e.id === empId && e.expo_push_token && e.expo_push_token.startsWith("ExponentPushToken["));
      if (employee) {
        sendExpoNotification(ss, {
          to: employee.expo_push_token,
          title: "Incoming Task Call",
          body: task.description || "New task assignment",
          data: JSON.stringify({
            taskId: task.task_id,
            type: 'fake_call',
            taskTitle: task.title,
            taskDescription: task.description || "",
            employeeId: employee.id
          }),
          priority: 'high',
          channelId: 'calls',
          sound: 'ringtone',
          _displayInForeground: true
        });
      }
    }
  });

  // Stop if all have read or max attempts reached
  if (allRead || attempt >= maxAttempts) {
    cleanupTaskNotificationLoop();
  }
}

/**
 * Cleans up the notification loop: removes trigger and clears properties.
 */
function cleanupTaskNotificationLoop() {
  // Remove all triggers for this function
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runTaskNotificationLoop') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  PropertiesService.getScriptProperties().deleteAllProperties();

}