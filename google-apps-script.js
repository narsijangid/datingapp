/**
 * Google Apps Script for handling dating app reports
 * This script receives report data and stores it in Google Sheets
 * 
 * To use:
 * 1. Open Google Sheets and create a new spreadsheet
 * 2. Go to Extensions → Apps Script
 * 3. Replace the default code with this script
 * 4. Update the SHEET_ID with your actual sheet ID
 * 5. Deploy as a web app with execute permissions for "Anyone"
 * 6. Copy the deployment URL and update it in your app's script.js
 */

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE'; // Replace with your actual sheet ID
const SHEET_NAME = 'Reports'; // Name of the sheet tab

function doPost(e) {
  try {
    // Enable CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle preflight OPTIONS request
    if (e.parameter.requestType === 'options' || e.parameter.options) {
      return ContentService
        .createTextOutput()
        .setHeaders(headers);
    }

    let reportData;
    
    // Parse the incoming data
    try {
      if (e.postData && e.postData.contents) {
        reportData = JSON.parse(e.postData.contents);
      } else if (e.parameter.data) {
        reportData = JSON.parse(e.parameter.data);
      } else {
        throw new Error('No data received');
      }
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Invalid JSON format'
        }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(headers);
    }

    // Validate required fields
    if (!reportData.reporter_id || !reportData.reported_user_id || !reportData.reason) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Missing required fields'
        }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(headers);
    }

    // Get or create the sheet
    const sheet = getOrCreateSheet();
    
    // Add the data to the sheet
    const newRow = [
      reportData.timestamp || new Date().toISOString(),
      reportData.reporter_id,
      reportData.reporter_name || 'Unknown',
      reportData.reported_user_id,
      reportData.reported_user_name || 'Unknown',
      reportData.reason,
      reportData.room_id || 'N/A',
      new Date().toISOString() // Server timestamp
    ];

    sheet.appendRow(newRow);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Report submitted successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(headers);

  } catch (error) {
    console.error('Error processing report:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*'
      });
  }
}

function doGet(e) {
  // Handle GET requests (for testing)
  return ContentService
    .createTextOutput(JSON.stringify({
      message: 'Google Apps Script is working. Use POST to submit reports.',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*'
    });
}

function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  
  try {
    return spreadsheet.getSheetByName(SHEET_NAME);
  } catch (e) {
    // Create the sheet if it doesn't exist
    const newSheet = spreadsheet.insertSheet(SHEET_NAME);
    
    // Add headers
    const headers = [
      'Timestamp',
      'Reporter ID',
      'Reporter Name',
      'Reported User ID',
      'Reported User Name',
      'Reason',
      'Room ID',
      'Server Timestamp'
    ];
    
    newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    newSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    newSheet.setFrozenRows(1);
    
    // Auto-resize columns
    newSheet.autoResizeColumns(1, headers.length);
    
    return newSheet;
  }
}

// Test function
function testReportSubmission() {
  const testData = {
    timestamp: new Date().toISOString(),
    reporter_id: 'test_user_123',
    reporter_name: 'Test User',
    reported_user_id: 'reported_user_456',
    reported_user_name: 'Reported User',
    reason: 'Inappropriate behavior',
    room_id: 'test_room_789'
  };

  const mockRequest = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const response = doPost(mockRequest);
  console.log('Test response:', response.getContent());
}