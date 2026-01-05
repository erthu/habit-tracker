// =====================================================
// GOOGLE APPS SCRIPT - Paste this into Apps Script
// =====================================================
// Go to Extensions → Apps Script in your Google Sheet
// Delete all existing code and paste this entire file
// Then: Deploy → New deployment → Web app
// Set "Who has access" to "Anyone"
// =====================================================

const SHEET_NAME = 'Tabellenblatt1'; // Change if your sheet tab has a different name
const SECRET_KEY = 'erthusecretthisisnice'; // Secret key for authentication

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    // Check secret key
    const providedKey = e.parameter.key;
    if (providedKey !== SECRET_KEY) {
      return sendResponse({ error: 'Unauthorized - invalid key' }, headers);
    }
    
    const action = e.parameter.action || 'read';
    
    if (action === 'read') {
      return sendResponse(getAllData(), headers);
    } else if (action === 'write') {
      const data = JSON.parse(e.parameter.data || e.postData.contents);
      return sendResponse(writeData(data), headers);
    } else if (action === 'update') {
      const data = JSON.parse(e.parameter.data || e.postData.contents);
      return sendResponse(updateData(data), headers);
    }
    
    return sendResponse({ error: 'Unknown action' }, headers);
  } catch (error) {
    return sendResponse({ error: error.toString() }, headers);
  }
}

function sendResponse(data, headers) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getAllData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    // Try to get first sheet if name doesn't match
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    if (sheets.length > 0) {
      return getSheetData(sheets[0]);
    }
    return { error: 'No sheet found' };
  }
  return getSheetData(sheet);
}

function getSheetData(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let value = data[i][j];
      // Convert Date objects to ISO string
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      row[headers[j]] = value;
    }
    rows.push(row);
  }
  
  return { headers: headers, rows: rows };
}

function writeData(data) {
  const sheet = getOrCreateSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 13).getValues()[0];
  
  // If no headers exist, create them
  if (!headers[0] || headers[0] === '') {
    const defaultHeaders = ['Datum', 'Gewicht', 'NoPorn', 'Polnisch', 'Sport', 'Zaehne', 'Alkohol', 'Schritte', 'Kreatin', 'Schlaf', 'Stimmung', 'Bildschirmzeit', 'Arbeitszeit', 'Notizen'];
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    headers.splice(0, headers.length, ...defaultHeaders);
  }
  
  // Check if date already exists
  const dateCol = headers.indexOf('Datum') + 1;
  const allDates = sheet.getRange(2, dateCol, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
  const inputDate = data.Datum;
  
  for (let i = 0; i < allDates.length; i++) {
    let existingDate = allDates[i][0];
    if (existingDate instanceof Date) {
      existingDate = Utilities.formatDate(existingDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    if (existingDate === inputDate) {
      // Update existing row
      return updateRow(sheet, headers, data, i + 2);
    }
  }
  
  // Add new row
  const newRow = headers.map(header => data[header] !== undefined ? data[header] : '');
  sheet.appendRow(newRow);
  
  // Sort by date descending (newest first)
  if (sheet.getLastRow() > 2) {
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    range.sort({ column: dateCol, ascending: false });
  }
  
  return { success: true, message: 'Data added successfully' };
}

function updateRow(sheet, headers, data, rowIndex) {
  const rowData = headers.map(header => data[header] !== undefined ? data[header] : '');
  sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  return { success: true, message: 'Data updated successfully' };
}

function updateData(data) {
  return writeData(data); // writeData already handles updates
}

function getOrCreateSheet() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    if (sheets.length > 0) {
      return sheets[0];
    }
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
  }
  return sheet;
}

// Test function - run this to verify the script works
function testScript() {
  const result = getAllData();
  Logger.log(JSON.stringify(result));
}
