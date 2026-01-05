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
      const headerName = headers[j];
      
      // Only convert Date objects to ISO string for the Datum column
      if (value instanceof Date) {
        if (headerName === 'Datum') {
          value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          // For other columns, if it's a time/date by accident, extract the number
          // Google Sheets stores times as fractions of a day (0.5 = 12:00)
          // If it's a small number (< 1), it's likely a time that should be hours
          const hours = value.getHours() + value.getMinutes() / 60;
          if (hours > 0) {
            value = hours;
          } else {
            // Might be a date used as a number, try to get numeric value
            value = data[i][j];
          }
        }
      }
      row[headerName] = value;
    }
    rows.push(row);
  }
  
  return { headers: headers, rows: rows };
}

function writeData(data) {
  const sheet = getOrCreateSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 14).getValues()[0];
  
  // If no headers exist, create them
  if (!headers[0] || headers[0] === '') {
    const defaultHeaders = ['Datum', 'Gewicht', 'NoPorn', 'Polnisch', 'Sport', 'Zaehne', 'Alkohol', 'Schritte', 'Kreatin', 'Schlaf', 'Stimmung', 'Bildschirmzeit', 'Arbeitszeit', 'Notizen'];
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    headers.splice(0, headers.length, ...defaultHeaders);
  }
  
  // Numeric fields that should not be auto-formatted as dates
  const numericFields = ['Gewicht', 'Alkohol', 'Schritte', 'Schlaf', 'Stimmung', 'Bildschirmzeit', 'Arbeitszeit'];
  
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
      return updateRow(sheet, headers, data, i + 2, numericFields);
    }
  }
  
  // Add new row - use setValues with NumberFormat to prevent date conversion
  const newRow = headers.map(header => data[header] !== undefined ? data[header] : '');
  const lastRow = sheet.getLastRow() + 1;
  const range = sheet.getRange(lastRow, 1, 1, newRow.length);
  range.setValues([newRow]);
  
  // Set numeric columns to plain text format to prevent date auto-conversion
  headers.forEach((header, idx) => {
    if (numericFields.includes(header)) {
      sheet.getRange(lastRow, idx + 1).setNumberFormat('@'); // @ = plain text
    }
  });
  
  // Sort by date descending (newest first)
  if (sheet.getLastRow() > 2) {
    const sortRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
    sortRange.sort({ column: dateCol, ascending: false });
  }
  
  return { success: true, message: 'Data added successfully' };
}

function updateRow(sheet, headers, data, rowIndex, numericFields) {
  const rowData = headers.map(header => data[header] !== undefined ? data[header] : '');
  const range = sheet.getRange(rowIndex, 1, 1, rowData.length);
  range.setValues([rowData]);
  
  // Set numeric columns to plain text format
  headers.forEach((header, idx) => {
    if (numericFields.includes(header)) {
      sheet.getRange(rowIndex, idx + 1).setNumberFormat('@');
    }
  });
  
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
