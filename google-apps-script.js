/**
 * Google Apps Script Web App for Student Activity Record System
 * 
 * Instructions:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1-0hbaN-21dHL7BYw-OtCeJHd351mnJ1g6K_7KzH2yL4/edit (or any other sheet)
 * 2. Go to Extensions -> Apps Script
 * 3. Delete any default code in Code.gs and paste this script.
 * 4. Click Save.
 * 5. Click Deploy -> New deployment.
 * 6. Select "Web app" as type.
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone"
 * 7. Click Deploy, authorize permissions, and copy the Web App URL.
 * 8. Paste the Web App URL into the settings tab of the Web Application.
 */

function doGet(e) {
  var action = e.parameter.action;
  var sheetId = e.parameter.sheetId;
  var sheetName = e.parameter.sheetName;
  
  if (!sheetId || !sheetName) {
    return createResponse({ status: 'error', message: 'Missing sheetId or sheetName' });
  }
  
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return createResponse([]);
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse([]);
    }
    
    var headers = data[0];
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var item = {};
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        if (val instanceof Date) {
          val = val.toISOString();
        }
        item[headers[j]] = val;
      }
      list.push(item);
    }
    return createResponse(list);
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return createResponse({ status: 'error', message: 'Invalid JSON payload: ' + err.toString() });
  }
  
  var action = params.action;
  var sheetId = params.sheetId;
  var sheetName = params.sheetName;
  
  if (!sheetId || !sheetName) {
    return createResponse({ status: 'error', message: 'Missing sheetId or sheetName' });
  }
  
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(sheetName);
    
    if (action === 'test') {
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        if (sheetName === 'scans') {
          sheet.appendRow(['id', 'timestamp', 'studentId', 'activityName', 'isValid', 'status']);
        } else if (sheetName === 'activities') {
          sheet.appendRow(['id', 'name', 'date', 'time']);
        }
      }
      return createResponse({ status: 'success', message: 'Connection successful. Sheet "' + sheetName + '" is ready.' });
    }
    
    if (action === 'append') {
      var rowData = params.rowData;
      if (!rowData || !Array.isArray(rowData)) {
        return createResponse({ status: 'error', message: 'rowData must be an array' });
      }
      
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        if (sheetName === 'scans') {
          sheet.appendRow(['id', 'timestamp', 'studentId', 'activityName', 'isValid', 'status']);
        } else if (sheetName === 'activities') {
          sheet.appendRow(['id', 'name', 'date', 'time']);
        }
      }
      
      sheet.appendRow(rowData);
      return createResponse({ status: 'success', message: 'Row appended successfully' });
    }
    
    if (action === 'deleteActivity') {
      var activityId = params.id;
      if (!sheet) {
        return createResponse({ status: 'error', message: 'Sheet not found' });
      }
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === activityId) {
          sheet.deleteRow(i + 1);
          return createResponse({ status: 'success', message: 'Row deleted successfully' });
        }
      }
      return createResponse({ status: 'error', message: 'Row not found' });
    }
    
    return createResponse({ status: 'error', message: 'Invalid action: ' + action });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function createResponse(output) {
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
}
